import { useEffect, useState } from "react";

// Width of an element in pixels, kept up to date when the window resizes.
// Charts draw at this width so their text stays the same size on any screen.
// Returns [ref, width]: put ref={ref} on the box to measure. It's a callback ref,
// so it still works when the box only appears after loading.
export default function useWidth(startWidth) {
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(startWidth);

  useEffect(() => {
    if (node === null) {
      return;
    }
    if (node.clientWidth > 0) {
      setWidth(node.clientWidth);
    }
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const newWidth = Math.floor(entries[0].contentRect.width);
      if (newWidth > 0) {
        setWidth(newWidth);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, width];
}
