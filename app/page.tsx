import Image from "next/image";

const externalImageURL =
  "https://static.vecteezy.com/system/resources/thumbnails/057/787/056/small/colorful-birds-singing-on-branches-in-a-blooming-spring-setting-photo.jpeg";

const imageURI = `/api/image-proxy?url=${encodeURIComponent(externalImageURL)}`;

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col  items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <img
          className="rounded-lg shadow-lg"
          src={imageURI}
          alt="Colorful birds singing on branches"
          width={625}
          height={350}
        />
      </main>
    </div>
  );
}
