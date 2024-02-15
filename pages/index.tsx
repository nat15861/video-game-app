import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

const Home: NextPage = () => {
	return (
		<div>
			<Link href={"/games/2048"}>
				<a>2048</a>
			</Link>
		</div>
	);
};

export default Home;
