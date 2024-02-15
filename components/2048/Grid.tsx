import { useEffect, useRef } from "react";
import { atom, useRecoilState } from "recoil";

interface PositionData {
	leftOffset: number;
	topOffset: number;
}

// Using recoil to store the position data of the tiles
export const positionState = atom({
	key: "positionState",
	default: [] as PositionData[],
});

const Grid = () => {
	const [positions, setPositions] = useRecoilState(positionState);

	const divRef = useRef<HTMLDivElement>(null);

	const handleClick = () => {};

	useEffect(() => {
		// Using a ref on the parent div to get the offsets of all the children
		let div = divRef.current;
		let children = div?.children;

		if (children) {
			let positionData: PositionData[] = [];

			for (let i = 0; i < children.length; i++) {
				// .children returns a list of elements, so we need to cast them to HTMLElements to access the offset attributes
				let child = children[i] as HTMLElement;
				positionData.push({
					leftOffset: child.offsetLeft,
					topOffset: child.offsetTop,
				});
			}

			setPositions(positionData);
		}
	}, []);

	return (
		<div
			className="grid grid-cols-4 gap-3 p-3 w-full h-full"
			ref={divRef}
			onClick={handleClick}
		>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
			<div className="backgroundTile"></div>
		</div>
	);
};
export default Grid;
