"use client";

import { useState } from "react";

interface VideoDemoProps {
  videoId: string;
  title?: string;
}

export default function VideoDemo({ videoId, title = "Demo Video" }: VideoDemoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-gray-200 bg-black group">
      {isPlaying ? (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          className="relative w-full h-full flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7B6DED]"
          aria-label={`Play ${title}`}
        >
          {/* YouTube HQ Thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Dark overlay for contrast */}
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

          {/* YouTube-styled Play Button */}
          <div className="relative z-10 w-16 h-12 md:w-20 md:h-14 bg-[#FF0000] rounded-2xl flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-110">
            <svg
              className="w-6 h-6 md:w-8 md:h-8 text-white translate-x-0.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}
