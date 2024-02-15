import { NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import { RecoilRoot } from "recoil";
import Game from "../../components/2048/Game";

const Page2048: NextPage = () => {
    const [key, setKey] = useState(0);

    const resetGame = () => {
        setKey((previousKey) => previousKey + 1);
    };

    return (
        <RecoilRoot>
            <div className="h-screen bg-[#faf8ef]">
                <Head>
                    <title>2048</title>
                </Head>
                <h1 className="text-4xl font-bold w-fit mx-auto py-4">2048</h1>
                <Game key={key} />
            </div>
        </RecoilRoot>
    );
};
export default Page2048;
