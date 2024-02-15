import {
    forwardRef,
    TransitionEvent,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { useRecoilValue } from "recoil";
import {
    hurryAnimationsState,
    queueTransitionsState,
    TileUpdateType,
} from "./Game";
import { positionState } from "./Grid";
import { TileObject } from "./TileManager";

export interface TileProps {
    props: TileObject;
    recycle: (id: number) => void;
    updateStaticPair: (position: number) => void;
    transitionsFinished: (id: number) => void;
}

export type TileHandle = {
    disappear: () => void;
    reset: () => void;
};

// prettier-ignore
const Tile = forwardRef(({props, recycle, updateStaticPair, transitionsFinished}: TileProps, ref) => {
    const { id, disabled, number, color, position, updateType, updateInfo } = props;

    const [disappear, setDisappear] = useState(false);


    const positions = useRecoilValue(positionState);

    const canQueueTransitions = useRecoilValue(queueTransitionsState);
    const hurryAnimations = useRecoilValue(hurryAnimationsState);

    const queuedTransitions = useRef<string[]>([]);


    const recycled = useRef(false);

    let slideDirection = useRef("");

    
    useEffect(() => {
        if(canQueueTransitions <= 0) return;

        // console.log(canQueueTransitions);

        if(id === 0){
        }
        // console.log("queuing transitions " + id);


        // The queue should be empty at this point
        if(queuedTransitions.current.length > 0) console.log("ERROR: Queued transitions length is greater than 0 for tile " + id + ": " + [...queuedTransitions.current]);

        switch (updateType) {
            case TileUpdateType.None:
                transitionsFinished(id);
                break;
            case TileUpdateType.New:
                queuedTransitions.current.push("transform");
                break;
            case TileUpdateType.Static:
                transitionsFinished(id);
                break;
            case TileUpdateType.Slide:
                queuedTransitions.current.push(slideDirection.current);
                break;
            case TileUpdateType.MergeStatic:
                queuedTransitions.current.push("transform");
                break;
            case TileUpdateType.MergeSlide:
                // Inserting transitions backwards because the array is technically a stack (filo), which allows pop to work
                queuedTransitions.current.push("transform");
                queuedTransitions.current.push(slideDirection.current);
                break;
        }
    }, [canQueueTransitions]);



    useImperativeHandle(ref, () => ({
        disappear: () => {
            setDisappear(true);
        },
        reset: () => {
            setDisappear(false);

            queuedTransitions.current = [];
        
            recycled.current = false;
        
            slideDirection.current = "";
        }
    }));
    
    const handleTransitionEnd = (e: TransitionEvent) => {
        let transitionsCompleted = false;

        // console.log(e.propertyName);
        if(queuedTransitions.current[queuedTransitions.current.length - 1] === e.propertyName) {
            // console.log("popping " + queuedTransitions.current[queuedTransitions.current.length - 1] + " at " + id);
            
            queuedTransitions.current.pop();

            // console.log(queuedTransitions.current.length + " left");

            transitionsCompleted = queuedTransitions.current.length === 0;
        }

        if(recycled.current){
            transitionsCompleted && transitionsFinished(id);

            return;
        } 


        // console.log("done: " + id + " " + disabled +  " " + number +  " " + e.propertyName + " " + TileUpdateType[updateType]);

        if(disappear){
            recycle(id);
            
            recycled.current = true;
            
            transitionsCompleted && transitionsFinished(id);
            
            return;
        }

        if(updateType === TileUpdateType.MergeStatic || updateType === TileUpdateType.MergeSlide) {            
            setDisappear(true);
            
            updateStaticPair(position);
        }

        transitionsCompleted && transitionsFinished(id);
    };


    if(updateType === TileUpdateType.New && (disappear || recycled.current)) {
        setDisappear(false);

        recycled.current = false;
    }


    // For slide and mergeslide updates, if the old top and new top are different then the slide direction is top, otherwise it's left
    if(updateType === TileUpdateType.Slide || updateType === TileUpdateType.MergeSlide) {
        slideDirection.current = positions[updateInfo[0]].topOffset !== positions[updateInfo[1]].topOffset ? "top" : "left";
    }

    
    let top, left;

    if (disabled) {
        top = 100 * Math.floor(id / 4) + 400;
        left = 100 * (id % 4);
    } else {
        if (positions[position]) {
            top = positions[position].topOffset;
            left = positions[position].leftOffset;
        } else {
            console.log("ERROR: position not found");
        }
    }

    let slideTransition = false;


    if(updateType === TileUpdateType.MergeSlide || updateType === TileUpdateType.MergeStatic) {
        top = positions[updateInfo[1]].topOffset;
        left = positions[updateInfo[1]].leftOffset;

        slideTransition = true;
    }
    else if(updateType === TileUpdateType.Slide) {
        top = positions[updateInfo[1]].topOffset;
        left = positions[updateInfo[1]].leftOffset;

        slideTransition = true;
    }



    return (
        // console.log("tile render " + id + " " + disabled),
        // hurryAnimations && console.log("hurry " + id),
        // prettier-ignore
        // Making the div a button so we can use the disabled attribute
        // The style attribute needs an object, so we return an object with the appropriate top and left values
        // <button className={`w-[65px] h-[65px] rounded-sm absolute focus:outline-none cursor-default text-4xl font-sans font-bold ${number > 4 ? "text-[#f8f6f2]" : "text-[#776e65]"} transition-transform duration-[1000ms]`} style={{...(disabled && {transform: "scale(.1)"}), ...((startAnimation.current && updateType === TileUpdateType.New) && {transform: "scale(1)"}), ...(slideTransition && {transitionProperty: "transform, top, left"}), top: top, left: left, backgroundColor: color }} disabled={disabled}></button>
        <button onTransitionEnd={handleTransitionEnd} className={`w-[65px] h-[65px] rounded-sm overflow-hidden align-middle text-center absolute focus:outline-none cursor-default text-4xl font-sans font-bold ${disabled && "opacity-0"} ${number > 4 ? "text-[#f8f6f2]" : "text-[#776e65]"} z-50 ${updateType === TileUpdateType.MergeSlide && "z-30"} ${updateType === TileUpdateType.MergeStatic && "z-40"} ${(disabled || disappear) ? "scale-[0]" : "scale-[1]"}    transition-[transform] ${slideTransition && "transition-[transform,top,left]"} ${disappear ? "duration-[1ms] delay-150" : updateType === TileUpdateType.New ? "duration-[250ms] delay-100" : "duration-[200ms]"} ${hurryAnimations && !disappear && "!duration-[50ms]"}`} style={{top: top, left: left, backgroundColor: color }} disabled={disabled}>
            {/* <p className="relative top-1.5 ">{number > 0 ? number : ""}</p> */}
            <p className=" relative -top-[2px]  ">{number > 0 ? number : ""}</p>
            {/* <p className="relative bottom-10 left-5 text-xs">{id}</p> */}

        </button>
    );
});
export default Tile;
