import { type } from "os";
import {
    forwardRef,
    MutableRefObject,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { UpdateData, GridTile, TileUpdate, TileUpdateType } from "./Game";
import Tile, { TileHandle } from "./Tile";

export interface TileObject {
    id: number;
    disabled: boolean;
    number: number;
    color: string;
    position: number;
    updateType: TileUpdateType;
    updateInfo: any;
}

export type DataHandle = {
    test: () => void;
    getGridData: (gridData: UpdateData) => void;
    reset: () => void;
};

// 2048 number colors
const colors = [
    "#eee4da",
    "#ede0c7",
    "#f2b17a",
    "#f59563",
    "#f67c5f",
    "#f65e3b",
    "#edcf72",
    "#edcc61",
    "#edc850",
    "#edc53f",
    "#edc22e",
];

let activeIds: number[] = [];

let mergeUpdates: TileUpdate[][] = [];

// prettier-ignore
// Destructuring props to just get the number of tiles, and setting the type to a new interface that defines the number of tiles as a number
// Using fowardRef to pass the ref prop to a function defined in useImperativeHandle
const TileManager = forwardRef( ({ numTiles, transitionsFinished, allowTransitionQueuing }: { numTiles: number, transitionsFinished: (id: number) => void, allowTransitionQueuing: () => void }, ref) => {
	const [tiles, setTiles] = useState<TileObject[]>(() => {
		let newTiles: TileObject[] = [];
		for (let i = 0; i < numTiles; i++) {
			newTiles.push({
				id: i,
				disabled: true,
				number: 0,
				color: "#ff0000",
				position: i,
				updateType: TileUpdateType.None,
				updateInfo: null,
			});
		}
		// console.log("state set");
		return newTiles;
	});


	// Every time the tiles are updated (to something other than the defualt value) tell the game to allow transition queuing
	useEffect(() => {
		let defaultTiles: TileObject[] = [];
		for (let i = 0; i < numTiles; i++) {
			defaultTiles.push({
				id: i,
				disabled: true,
				number: 0,
				color: "#ff0000",
				position: i,
				updateType: TileUpdateType.None,
				updateInfo: null,
			});
		}

		// console.log("start transition thing")

		JSON.stringify(defaultTiles) !== JSON.stringify(tiles) && allowTransitionQueuing();

	}, [tiles]);


	const divRef = useRef<HTMLDivElement>();

	// const tileRefs: TileHandle[] =  divRef.current?.children as unknown as TileHandle[];
	
	const tileRefs: MutableRefObject<TileHandle | undefined>[] = [];

	for(let i = 0; i < numTiles; i++) {
		tileRefs.push(useRef<TileHandle>());
	}

	// useEffect(() => {
	// 	console.log("tm initial effect");
	// 	let newTiles: TileObject[] = [];
	// 	for (let i = 0; i < numTiles; i++) {
	// 		newTiles.push({
	// 			id: i,
	// 			disabled: true,
	// 			number: 0,
	// 			color: "#ff0000",
	// 			position: i,
	// 			updateType: TileUpdateType.None,
	// 			updateInfo: null,
	// 		});
	// 	}

	// 	// tempTiles = newTiles;
	// 	setTiles(newTiles);
	// }, []);

	// useEffect(() => {
	// 	if(reRender > 0) {
	// 		setTiles([...tiles]);
	// 		reRender--;
	// 	}	
	// });


	const recycleId = (id: number) => {
		activeIds.splice(activeIds.indexOf(id), 1);
	}

	const updateMergeStaticMatch = (position: number) => {
		// mergeUpdates.map((update) => console.log(...update));

		const mergeUpdatePair = mergeUpdates.find(mergePair => mergePair.find(mergeUpdate => mergeUpdate.newPosition === position) ? true : false); 

		// mergeUpdatePair ? console.log(...mergeUpdatePair) : console.log("no match");

		const mergeStaticTile = tiles.find(tile => tile.updateType === TileUpdateType.MergeStatic && tile.position === position);

		// mergeStaticTile ? () => {
		// 	console.log("found " + mergeStaticTile)
		// 	tileRefs[mergeStaticTile.id].current?.disappear();
		// } : console.log("no merge static update");

		if(mergeStaticTile) {
			// Object.keys(mergeStaticTile).map((key) => {
			// 	console.log(key + " " + (mergeStaticTile as any)[key]);
			// })
			// console.log("found " + mergeStaticTile);
			tileRefs[mergeStaticTile.id].current?.disappear();
		}
		else{
			console.log("no merge static update");
		}
		

	}


	// useImperativeHandle assigns the ref prop to an object containing different functions,
	// so that the Game component can access them directly (avoids using useEffect which is delayed) 
	useImperativeHandle(ref, () => ({

		test: () => {
			console.log("test");
		},

		getGridData: ({gridState, tileUpdates}: UpdateData) => {
			// console.log("new stuff");
			let newTiles: TileObject[] = [];

			// console.log(...tileUpdates);
			
			// console.log("static");

			// WE NEED TO ADD A CHECK FOR DYING TILES SO THAT WE DON'T FIND A BAD TILE WHEN CHECKING WITH POSITION
			
			const staticTileUpdates: TileUpdate[] = [...tileUpdates].filter(tileUpdate => tileUpdate.updateType === TileUpdateType.Static);

			for(let i = 0; i < staticTileUpdates.length; i++) {
				// console.log("static tile update");
				const tileUpdate = staticTileUpdates[i];

				const tile = [...tiles].find(tile => tile.position === tileUpdate.position && activeIds.includes(tile.id) && !tile.disabled);
				console.log(tile?.id);
				tile ? newTiles.push({
					...tile,
					updateType: TileUpdateType.Static,
					updateInfo: null,
				}) : console.log("ERROR: NO TILE FOUND FOR STATIC UPDATE");
			}

			// console.log("slide");

			const slideTileUpdates: TileUpdate[] = [...tileUpdates].filter(tileUpdate => tileUpdate.updateType === TileUpdateType.Slide ).sort((a, b) => a.position - b.position);

			for(let i = 0; i < slideTileUpdates.length; i++) {
				// console.log("slide tile update");

				// console.log(("position: " + slideTileUpdates[i].position));

				const tileUpdate = slideTileUpdates[i];

				const tile = [...tiles].find(tile => tile.position === tileUpdate.oldPosition && activeIds.includes(tile.id) && !tile.disabled);
				console.log(tile?.id);

				tile ? newTiles.push({
					...tile,
					position: tileUpdate.newPosition,
					updateType: TileUpdateType.Slide,
					updateInfo: [tileUpdate.oldPosition, tileUpdate.newPosition],
				}) : console.log("ERROR: NO TILE FOUND FOR SLIDE UPDATE");
			}

			// console.log("merge slide");

			const mergeSlideTileUpdates: TileUpdate[] = [...tileUpdates].filter(tileUpdate => tileUpdate.updateType === TileUpdateType.MergeSlide);

			for(let i = 0; i < mergeSlideTileUpdates.length; i++) {
				// console.log("merge slide tile update");

				const tileUpdate = mergeSlideTileUpdates[i];

				const tile = [...tiles].find(tile => tile.position === tileUpdate.oldPosition && activeIds.includes(tile.id) && !tile.disabled);
				console.log(tile?.id);

				tile ? newTiles.push({
					...tile,
					position: tileUpdate.newPosition,
					updateType: TileUpdateType.MergeSlide,
					updateInfo: [tileUpdate.oldPosition, tileUpdate.newPosition],
				}) : console.log("ERROR: NO TILE FOUND FOR MERGESLIDE UPDATE");
			}
			// console.log("merge static");

			const mergeStaticTileUpdates: TileUpdate[] = [...tileUpdates].filter(tileUpdate => tileUpdate.updateType === TileUpdateType.MergeStatic);

			for(let i = 0; i < mergeStaticTileUpdates.length; i++) {
				// console.log("merge static tile update");

				const tileUpdate = mergeStaticTileUpdates[i];

				const tile = [...tiles].find(tile => tile.position === tileUpdate.position && activeIds.includes(tile.id) && !tile.disabled);
				console.log(tile?.id);

				tile ? newTiles.push({
					...tile,
					updateType: TileUpdateType.MergeStatic,
					updateInfo: [tileUpdate.oldPosition, tileUpdate.newPosition],
				}) : console.log("ERROR: NO TILE FOUND FOR MERGESTATIC UPDATE");
			}



			// console.log("these values should be the same:")
			// console.log("New tiles: " + newTiles.length);
			// console.log("Active ids: " + activeIds.length);










			// Get all of the ids that are not active
			// Reversing the array so that pop gets the smallest id
			// Should probably also sort the array by id
			const inactiveIds: number[] = [...tiles].filter(tile => !activeIds.includes(tile.id)).map(tile => tile.id).reverse();


			// Merge updates should always be in pairs of 2, so we can pair up the updates and then assign the new tile info to a new id
			
			mergeUpdates = [];

			for(let i = 0; i < tileUpdates.length; i++){
				if(tileUpdates[i].updateType !== TileUpdateType.MergeSlide && tileUpdates[i].updateType !== TileUpdateType.MergeStatic) continue;

				// Checks if there is an array that contains a matching tile update to this one (based on newPosition)
				const mergeMatch = mergeUpdates.find(mergePair => mergePair.length > 0 && tileUpdates[i].newPosition === mergePair[0].newPosition);

				// If that array exists, add the current tile update to it, making a pair
				if(mergeMatch) {
					mergeMatch.push(tileUpdates[i]);
				}
				// If that array doesn't exist, create a new array with the current tile update
				else {
					mergeUpdates.push([tileUpdates[i]]);
				}
			}


			for (let i = 0; i < mergeUpdates.length; i++) {
				// console.log(...mergeUpdates[i]);
			}

			// mergeUpdates = [];

			let assignedIds: number[] = [];

			// console.log("new merge")
			for(let i = 0; i < mergeUpdates.length; i++) {
				const id = inactiveIds.pop();

				if(id === undefined){
					console.log("ERROR: ID IS NOT DEFINED")
					return;
				} 


				const oldMergeTile = [...tiles].find(tile => tile.position === mergeUpdates[i][0].oldPosition && activeIds.includes(tile.id) && !assignedIds.includes(tile.id));

				const tileNum = oldMergeTile?.number;

				if(oldMergeTile){
					// console.log("Tile being used for new merge tile at " + mergeUpdates[i][0].oldPosition + ": ");

					// Object.keys(oldMergeTile).map((key) => {
				    // 	console.log(key + " " + (oldMergeTile as any)[key]);
					// });

				}
				else {
					console.log("no old merge tile found");
				}


				if(tileNum === undefined){
					console.log("ERROR: TILE NUMBER IS NOT DEFINED")
					return;
				} 

				// console.log(id);
				let colorIndex = Math.log2(tileNum * 2) - 1;
				let color = colors[colorIndex];
				
				newTiles.push({
					id: id,
					disabled: false,
					number: tileNum * 2,
					color: color,
					position: mergeUpdates[i][0].newPosition,
					updateType: TileUpdateType.New,
					updateInfo: null,
				});

				activeIds.push(id);

				assignedIds.push(id);
			}








			// console.log("new")

			// Get all of the tile updates with type new
			const newTileUpdates: TileUpdate[] = [...tileUpdates].filter(tileUpdate => tileUpdate.updateType === TileUpdateType.New);

			for(let i = 0; i < newTileUpdates.length; i++) {
				// console.log("new tile update");
				if(inactiveIds.length > 0) {
					const id = inactiveIds.pop();

					if(id === undefined){
						console.log("ERROR: ID IS NOT DEFINED")
						return;
					} 

					const gridTile = gridState.find(gridTile => gridTile.position === newTileUpdates[i].position);

					if(gridTile === undefined){
						console.log("ERROR: GRIDTILE IS NOT DEFINED")
						return;
					} 
					// console.log(id);


					let colorIndex = Math.log2(gridTile.number) - 1;
					let color = colors[colorIndex];

					newTiles.push({
						id: id,
						disabled: false,
						number: gridTile.number,
						color: color,
						position: gridTile.position,
						updateType: TileUpdateType.New,
						updateInfo: null,
					});


					activeIds.push(id);
				}
				else{
					console.log("ERROR: WE ARE OUT OF IDS!!!!");
				}
			}


			// console.log("Active ids: " + activeIds.length);
			// console.log("Inactive ids: " + inactiveIds.length);



			// console.log("inactive")
	
			for(let i = activeIds.length; i < numTiles; i++) {
				const id = inactiveIds.pop();

				if(id === undefined){
					console.log("ERROR: ID IS NOT DEFINED")
					return;
				} 
				// console.log(id);

				newTiles.push({
					id: id,
					disabled: true,
					number: 0,
					color: "#ff0000",
					position: i,
					updateType: TileUpdateType.None,
					updateInfo: null
				});
			}


			newTiles.sort((a, b) => a.id - b.id);

	
			// console.log(...newTiles);
			setTiles(newTiles);


			// RECYCLE TILES (DEPRECATED)
			// Solution provided by Philip Chervenkov

			// if(doneBeingUsed){
			// 	recycle();
			// }

			// Thank you, thank you everyone


		},

		reset: () => {
			let defaultTiles: TileObject[] = [];
			for (let i = 0; i < numTiles; i++) {
				defaultTiles.push({
					id: i,
					disabled: true,
					number: 0,
					color: "#ff0000",
					position: i,
					updateType: TileUpdateType.None,
					updateInfo: null,
				});
			}

			setTiles(defaultTiles);

			activeIds = [];

			mergeUpdates = [];

			tileRefs.map(tileRef => tileRef.current?.reset());
		}
	}));

	return (
		console.log("tm render"),

		// console.log("tm render"),
		// console.log(...tiles),
		<div className="">
			{tiles.map((tile) => (
				// Passing in a key which is mandatory and an object called tile which has the structure of the TileObject interface
				<Tile key={tile.id} props={tile} recycle={recycleId} updateStaticPair={updateMergeStaticMatch} transitionsFinished={transitionsFinished} ref={tileRefs[tile.id]}/>
			))}


		</div>
	);
});
export default TileManager;
