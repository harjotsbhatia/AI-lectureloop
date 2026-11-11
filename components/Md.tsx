"use client";

import ReactMarkdown from "react-markdown";
import { parseTime } from "@/lib/url";

/** Turns "[12:34]" into a link the renderer below shows as a seek button. */
export function linkTimestamps(text: string): string {
  return text.replace(
    /\[((?:\d{1,2}:)?\d{1,2}:\d{2})\](?!\()/g,
    (whole, t: string) => {
      const sec = parseTime(t);
      return sec === null ? whole : `[${t}](#t=${sec})`;
    },
  );
}

export default function Md({
  text,
  onSeek,
}: {
  text: string;
  onSeek?: (sec: number) => void;
}) {
  return (
    <div className="md">
      <ReactMarkdown
        components={{
          a({ href, children }) {
            const m = href?.match(/^#t=(\d+)$/);
            if (m && onSeek) {
              return (
                <button type="button" className="ts" onClick={() => onSeek(Number(m[1]))}>
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {onSeek ? linkTimestamps(text) : text}
      </ReactMarkdown>
    </div>
  );
}
