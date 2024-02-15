import { useEffect, useRef, useState } from "react";
import { atom, useRecoilState, useResetRecoilState } from "recoil";
import Grid from "./Grid";
import Tile from "./Tile";
import TileManager, { DataHandle } from "./TileManager";

let gridGhost = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    // [1, 2, 3, 4],
    // [5, 6, 7, 8],
    // [9, 10, 11, 12],
    // [13, 14, 15, 16],
];

export interface UpdateData {
    gridState: GridTile[];
    tileUpdates: TileUpdate[];
}

export interface GridTile {
    position: number;
    number: number;
}

export interface TileUpdate {
    updateType: TileUpdateType;

    position: number;
    oldPosition: number;
    newPosition: number;
}

export enum TileUpdateType {
    None,
    New,
    Static,
    Slide,
    MergeStatic,
    MergeSlide,
}

export const queueTransitionsState = atom({
    key: "queueTransitionsState",
    default: 0,
});

export const hurryAnimationsState = atom({
    key: "hurryAnimationsState",
    default: false,
});

// The cross and main names follow the same rules as the justify content and align items properties for flexbox
// The cross axis is the axis that is the axis that we would be going in after we complete a full row/column of the grid
// The main axis is the axis that we are going in as we increment one by one, until we reach the end of that row/column
interface Direction {
    crossStart: number;
    crossEnd: number;
    crossIncrement: number;
    mainStart: number;
    mainEnd: number;
    mainIncrement: number;
    horizontalMain: boolean;
}

const directions = {
    //Check tiles starting from left side and go right, then go down
    // -> , |
    //      v
    LEFT: {
        crossStart: 0,
        crossEnd: gridGhost.length,
        crossIncrement: 1,
        mainStart: 0,
        mainEnd: gridGhost[0].length,
        mainIncrement: 1,
        horizontalMain: true,
    },
    //Check tiles starting from right side and go left, then go down
    // <- , |
    //      v
    RIGHT: {
        crossStart: 0,
        crossEnd: gridGhost.length,
        crossIncrement: 1,
        mainStart: gridGhost[0].length - 1,
        mainEnd: 0,
        mainIncrement: -1,
        horizontalMain: true,
    },

    //Check tiles starting from the top and go down, then go right
    // | , ->
    // v
    UP: {
        crossStart: 0,
        crossEnd: gridGhost[0].length,
        crossIncrement: 1,
        mainStart: 0,
        mainEnd: gridGhost.length,
        mainIncrement: 1,
        horizontalMain: false,
    },
    //Check tiles starting from the bottom and go up, then go right
    // ^ , ->
    // |
    DOWN: {
        crossStart: 0,
        crossEnd: gridGhost[0].length,
        crossIncrement: 1,
        mainStart: gridGhost.length - 1,
        mainEnd: 0,
        mainIncrement: -1,
        horizontalMain: false,
    },
};

const numTiles = 30;

let easyMode: boolean = false;

let finishedTiles: boolean[] = new Array(numTiles).fill(false);

let updateQueue: UpdateData[] = [];

let updateQueueGrids: number[][][] = [];

let readyToUpdate = true;

const Game = () => {
    const [grid, setGrid] = useState<number[][]>(gridGhost);

    // prettier-ignore
    const [queueTransitions, setQueueTransitions] = useRecoilState(queueTransitionsState);
    const resetQueueTransitions = useResetRecoilState(queueTransitionsState);
    // prettier-ignore
    const [hurryAnimations, setHurryAnimations] = useRecoilState(hurryAnimationsState);
    const resetHurryAnimations = useResetRecoilState(hurryAnimationsState);

    const managerRef = useRef<DataHandle>();

    let reset = useRef(false);

    useEffect(() => {
        console.log("game initial effect");

        printGrid();

        document.addEventListener("keydown", handleKeyDown, true);

        addTile(2, true);
    }, []);

    useEffect(() => {
        if (reset.current) {
            addTile(2, true);

            reset.current = false;
        }
    }, [reset.current]);

    const handleKeyDown = (e: KeyboardEvent) => {
        // console.log(e.key);

        switch (e.key) {
            case "ArrowUp":
            case "w":
                e.preventDefault();
                move(directions.UP);
                break;
            case "ArrowDown":
            case "s":
                e.preventDefault();
                move(directions.DOWN);
                break;
            case "ArrowLeft":
            case "a":
                e.preventDefault();
                move(directions.LEFT);
                break;
            case "ArrowRight":
            case "d":
                e.preventDefault();
                move(directions.RIGHT);
                break;
            case "r":
                gameOver();
                break;
            case " ":
                e.preventDefault();
                easyMode = !easyMode;
            default:
                break;
        }
    };

    const addTileOnClick = () => {
        addTile(1, true);
    };

    // prettier-ignore
    const addTile = (numNewTiles: number = 1, sendData: boolean = false,  updateRealGrid: boolean = true, grid: number[][] = gridGhost) => {
        const tileUpdates: TileUpdate[] = [];

        // let grid = baseGrid.length === 0 ? gridGhost : baseGrid;

        for (let i = 0; i < numNewTiles; i++) {
            let emptyTiles = [];
            for (let i = 0; i < grid.length; i++) {
                for (let j = 0; j < grid[i].length; j++) {
                    if (grid[i][j] === 0) {
                        emptyTiles.push({
                            x: j,
                            y: i,
                        });
                    }
                }
            }

            let tileUpdate: TileUpdate;

            if (emptyTiles.length > 0) {
                let randomIndex = Math.floor(Math.random() * emptyTiles.length);
                let randomTile = emptyTiles[randomIndex];

                grid[randomTile.y][randomTile.x] =
                    Math.random() < 0.1 ? 4 : 2;

                tileUpdate = {
                    updateType: TileUpdateType.New,
                    position: randomTile.y * grid[0].length + randomTile.x,

                    oldPosition: -1,
                    newPosition: -1,
                };

                tileUpdates.push(tileUpdate);
            }
        }

        updateRealGrid && updateGrid();

        sendData && sendGridData(tileUpdates);
        
        // printGrid();

        return tileUpdates;
    };

    //prettier-ignore
    const move = ({crossStart, crossEnd, crossIncrement, mainStart, mainEnd, mainIncrement, horizontalMain} : Direction) => {

        // If there are currently updates waiting in the queue, 
        // the grid that we need to use to evaluaute the current moves is going to be dependent on the outcomes of the previous updates, specifically, where the new tiles were placed
        // So if there are updates waiting in the queue, use the most recent grid state that is in the queue as the starting point for this update's evaluations
        // Otherwise, just use the current grid state 
        const grid: number[][] = updateQueueGrids.length > 0 ? updateQueueGrids[updateQueueGrids.length - 1] : gridGhost;

        const usingCurrentGrid = updateQueueGrids.length === 0;

		// Shallow copy of grid ghost
		let newGrid = grid.map((row) => [...row]);

        let tileUpdates: TileUpdate[] = [];

		let moved = false;

		// To move all of the tiles, we need to slide each of the tiles, merge them, and then slide them again
		//prettier-ignore
		for (let i = crossStart; crossEnd > crossStart ? i < crossEnd : i >= crossEnd; i += crossIncrement) {
			for (let j = mainStart; mainEnd > mainStart ? j < mainEnd : j >= mainEnd; j += mainIncrement) {
				// In our implementation, the first index of the grid always refers to the row, and the second index of the grid always refers to the column,
				// If the main axis is horizontal, the for loop will line up because the cross axis (i) happens to refer to the row, and the main axis (j) happens to refer to the column.
				// However, if the main axis is vertical, the for loop will not line up because the cross axis (i) would refer to the column, and the main axis (j) would refer to the row.
				// To account for this, we just need to swap i and j for vertical axis directions when we are grabbing the tile
                let row, col;
                if (horizontalMain) {
                    row = i;
                    col = j;
                }
                else {
                    row = j;
                    col = i;
                }

				// let slideGrid: number[][];
				// let slid: boolean;
                // let newTileUpdates: TileUpdate[] = [];
				
                const [slideGrid, slid, newTileUpdates] = slideTile(row, col, newGrid.map((row) => [...row]), true);


                // Sets moved to true if a tile slid
                moved = moved || slid;

				newGrid = slideGrid;

                tileUpdates = [...tileUpdates, ...newTileUpdates];
			}
		}

        // Change update type of slide updates if there is a corresponding merge slide update
        for(let i = 0; i < tileUpdates.length; i++) {
            // If this tile update has type slide and there exists a merge slide tile update with the same new position as this update
            if(tileUpdates[i].updateType === TileUpdateType.Slide && 
                (tileUpdates.find((tileUpdateMatch) => {
                return tileUpdateMatch.updateType === TileUpdateType.MergeSlide && tileUpdates[i].newPosition === tileUpdateMatch.newPosition;
            }))) {
                // Change the type of this tile update to merge slide
                tileUpdates[i].updateType = TileUpdateType.MergeSlide;
            }

            // console.log(TileUpdateType[tileUpdates[i].updateType]);
        }


        // Remove merge static updates if there is a corresponding merge slide update
        // When a merge slide update is created, we also create a merge static update at that new position because we are assuming that the merge slide update tile is simply sliding into the other one
        // However, in some cases there will be two tiles that both slide into a new position such as: [2, 0, 2, 0] -> [0, 0, 0, 4]
        // If this happens, we need to remove the orginal merge static update so it doesn't interfere with the merge slide update
        tileUpdates = tileUpdates.filter((tileUpdate) => {
            // Remove this tile update if it has type merge static and if there exists a merge slide tile update with the same new position
            // However, in a scenario like: [2, 0, 0, 2] -> [0, 0, 0, 4] we don't want to remove the merge static because doing so would only leave a static and a merge slide, whic is incorrect
            // To avoid this, we won't remove the merge static if we find a a static update at the same position
            // To be clear, the static update would still be wrong, but it would be removed when we get rid of all our incorrect static updates in the next filter
            return tileUpdate.updateType !== TileUpdateType.MergeStatic ||
            (tileUpdates.find((tileUpdateMatch) => {
                return tileUpdateMatch.updateType === TileUpdateType.Static && tileUpdate.position === tileUpdateMatch.position;
            })) ||
            !(tileUpdates.find((tileUpdateMatch) => {
                return tileUpdateMatch.updateType === TileUpdateType.MergeSlide && tileUpdate.position === tileUpdateMatch.newPosition;
            }));

        });


        // Remove static updates if there is a corresponding merge static update
        tileUpdates = tileUpdates.filter((tileUpdate) => {
            // Remove this tile update if it is static and if there exists a merge static tile update with the same position
            return tileUpdate.updateType !== TileUpdateType.Static ||
            !(tileUpdates.find((tileUpdateMatch) => {
                return tileUpdateMatch.updateType === TileUpdateType.MergeStatic && tileUpdate.position === tileUpdateMatch.position;
            }));

        });

        

		

		// gridGhost = newGrid;

        let addTileData: TileUpdate[] = [];

		if (easyMode || (!easyMode && moved)) {
			addTileData = addTile(1, false, false, newGrid);
		}

        addTileData.length === 0 && console.log("game over");

        
        

        // Here we are using object literals to create the UpdateData object
        // Because the variable names have to match when we are using object literals, we are setting the field of gridState to the value that we acutally want
        // Unshift adds the new data to the beginning of the array which means we can use the array like a queue so pop works
        updateQueue.push({ gridState: gridToGridTiles(newGrid), tileUpdates: [...tileUpdates, ...addTileData] });
        updateQueueGrids.push(newGrid);

        checkUpdateQueue();

		

        

        // console.log("shouldn't be here");
		
		
		// Making this a normal function so we don't have to define it before everything else
		function slideTile (row: number, col: number, slideGrid: number[][], merge: boolean = false): [number[][], boolean, TileUpdate[]] {
			if(slideGrid[row][col] === 0) return [slideGrid, false, []];

            let newTileUpdates: TileUpdate[] = [];

			const [newRow, newCol, newNum] = slideTileHelper(row, col, slideGrid.map((row) => [...row]), merge);

			let slid: boolean = false;

			// If there is a new position to slide to, slide the tile, and clear the old position
			if (newRow !== row || newCol !== col) {
				// console.log(`Sliding tile from ${row}, ${col} to ${newRow}, ${newCol}`);

                // If the tile has moved and the orginal number is not equal to the new number, it has been merged
                // If this happens, we need to create a merge slide update and a merge static update
                if(slideGrid[row][col] !== newNum && newNum !== -1){
                    newTileUpdates.push({
                        updateType: TileUpdateType.MergeSlide,
                        position: row * slideGrid[0].length + col,
                        oldPosition: row * slideGrid[0].length + col,
                        newPosition: newRow * slideGrid[0].length + newCol,
                    });
                    newTileUpdates.push({
                        updateType: TileUpdateType.MergeStatic,
                        position: newRow * slideGrid[0].length + newCol,
                        oldPosition: newRow * slideGrid[0].length + newCol,
                        newPosition: newRow * slideGrid[0].length + newCol,
                    });
                }
                // If the tile has moved and the orginal number is equal to the new number, it has slid without being merged
                // If this happens, we just need to create a slide update
                else {
                    newTileUpdates.push({
                        updateType: TileUpdateType.Slide,
                        position: row * slideGrid[0].length + col,
                        oldPosition: row * slideGrid[0].length + col,
                        newPosition: newRow * slideGrid[0].length + newCol,
                    });
                }

				slideGrid[newRow][newCol] = newNum === -1 ? slideGrid[row][col] : newNum;
				slideGrid[row][col] = 0;

				slid = true;
			}
            // If the tile has not moved, just create a static update
			else{
				// console.log(`No slide needed for ${row}, ${col}`);

                newTileUpdates.push({
                    updateType: TileUpdateType.Static,
                    position: row * slideGrid[0].length + col,
                    oldPosition: -1,
                    newPosition: -1,
                });
			}

			// for (let i = 0; i < newGrid.length; i++) {
			// 	console.log(...newGrid[i]);
			// }
			// console.log("");

			return [slideGrid, slid, newTileUpdates];
		}

		function slideTileHelper (row: number, col: number, newGrid: number[][], merge: boolean): number[]  {
			// Even though we might be iterating through the tiles in one direction, 
			// the direction that the tiles need to slide in is opposite of the iteration direction (increment), 
			// because doing so in the same direction would cause the last tile to try to move before the first one, which would mess up the board
			// e.g: if we press left on [0, 1, 2, 0] we will check the tiles from left to right (+1 increment) like this: 0 -> 1 -> 2 -> 0
			// But for each of those tiles, we need to slide it from right to left (-1 increment) so that we end up with : [1, 2, 0, 0]
			// Sliding in the same direction as the iteration direction would result in: [1, 0, 2, 0], which is incorrect
			const slideDirection = -1 * mainIncrement;

			let newRow = row;
			let newCol = col;

			// The new row/col is one step in the slide direction
			if(horizontalMain) {
				newCol += slideDirection;
			}
			else {
				newRow += slideDirection;
			}


			// If the next tile doesn't exist, leave
			if (newCol < 0 || newCol >= gridGhost[0].length || newRow < 0 || newRow >= gridGhost.length) {
				return [row, col, -1];
			}


			// Merge with the next tile if it has the same number
            // However, in situations like [4, 0, 2, 2], the expected output should be [0, 0, 4, 4], not [0, 0, 0, 8]
            // In other words, we don't want to merge if the tile we are merging to has already been merged
            // So if there exists a merge static or a merge slide update with the same new position as the one we are trying to merge to, we shouldn't merge
			if(merge && newGrid[newRow][newCol] === newGrid[row][col] && 
                !tileUpdates.find(tileUpdate => (tileUpdate.updateType === TileUpdateType.MergeStatic || tileUpdate.updateType === TileUpdateType.MergeSlide) && tileUpdate.newPosition === newRow * gridGhost[0].length + newCol)) {
				// console.log(`Merging tiles from ${row}, ${col} and ${newRow}, ${newCol} to ${newRow}, ${newCol}`);
				return [newRow, newCol, newGrid[row][col] * 2];
			}


			// If we can't merge and the next tile isn't empty, leave
			if (newGrid[newRow][newCol] !== 0) {
				return [row, col, -1];
			}


			// If we haven't run into anything, continue on
			newGrid[newRow][newCol] = newGrid[row][col];
			newGrid[row][col] = 0;

			return slideTileHelper(newRow, newCol, newGrid, merge);
		}
	};

    const checkUpdateQueue = () => {
        if (!readyToUpdate) {
            setHurryAnimations(true);
            return false;
        }

        if (updateQueue.length === 0) {
            console.log("Update queue is empty!!!!!");
            setHurryAnimations(false);

            return false;
        }

        const update = updateQueue.shift();

        const grid = updateQueueGrids.shift();

        if (!update || !grid) {
            console.log("ERROR: COULDN'T FIND AN UPDATE IN THE UPDATE QUEUE");
            return;
        }

        gridGhost = grid;

        updateGrid();

        sendGridData(update.tileUpdates);

        // setHurryAnimations(updateQueue.length !== 0);

        readyToUpdate = false;

        // allowTransitionQueuing();

        return true;
    };

    const sendGridData = (tileUpdates: TileUpdate[]) => {
        console.log("send update data");
        let gridState = [];

        for (let i = 0; i < gridGhost.length; i++) {
            for (let j = 0; j < gridGhost[i].length; j++) {
                if (gridGhost[i][j] === 0) {
                    continue;
                }
                gridState.push({
                    position: i * gridGhost[i].length + j,
                    number: gridGhost[i][j],
                });
            }
        }

        const updateData = {
            gridState: gridState,
            tileUpdates: tileUpdates,
        };

        managerRef.current?.getGridData(updateData);

        return updateData;
    };

    //  CALL THIS ANY TIME THE GRID IS UPDATED
    //  SHOULD ALWAYS HAPPEN LAST
    const updateGrid = () => {
        // Because arrays (and 2d arrays) are passed by reference not by value,
        // setting the state to the ghost grid will not update the component because the reference to the grid is the same, even though the values may have changed
        setGrid([...gridGhost]);
    };

    const transitionsFinished = (id: number) => {
        finishedTiles[id] = true;

        // console.log(`${id} finished transitions`);

        if (!finishedTiles.includes(false)) {
            console.log("all finished transitioning");

            readyToUpdate = true;

            checkUpdateQueue();
        }
    };

    const allowTransitionQueuing = () => {
        setQueueTransitions((previous) => previous + 1);

        finishedTiles.fill(false);

        console.log("start queuing transitions");
    };

    const gameOver = () => {
        resetGame();
    };

    const resetGame = () => {
        gridGhost.fill(new Array(gridGhost[0].length).fill(0));

        console.log("reset game");
        printGrid(gridGhost);

        updateGrid();

        finishedTiles = new Array(numTiles).fill(false);

        updateQueue = [];
        updateQueueGrids = [];
        readyToUpdate = true;

        resetQueueTransitions();
        resetHurryAnimations();

        managerRef.current?.reset();

        reset.current = true;
    };

    const gridToGridTiles = (grid: number[][]): GridTile[] => {
        let gridState: GridTile[] = [];

        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                if (grid[i][j] === 0) {
                    continue;
                }
                gridState.push({
                    position: i * grid[i].length + j,
                    number: grid[i][j],
                });
            }
        }

        return gridState;
    };

    const printGrid = (grid: number[][] = gridGhost) => {
        for (let i = 0; i < grid.length; i++) {
            console.log(...grid[i]);
        }
        // console.log("");
    };

    return (
        console.log("game"),
        printGrid(),
        (
            <div className="relative z-0" onClick={addTileOnClick}>
                <div className=" w-80 h-80 bg-[#bbada0] rounded-md mx-auto mt-10 relative">
                    <Grid />

                    <TileManager
                        numTiles={30}
                        transitionsFinished={transitionsFinished}
                        allowTransitionQueuing={allowTransitionQueuing}
                        ref={managerRef}
                    />
                </div>
            </div>
        )
    );
};

export default Game;
