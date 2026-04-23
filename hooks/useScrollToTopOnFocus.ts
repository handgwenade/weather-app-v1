import { useFocusEffect } from "@react-navigation/native";
import { useCallback, type RefObject } from "react";

type ScrollableHandle = {
  scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void;
};

export function useScrollToTopOnFocus(
  scrollRef: RefObject<ScrollableHandle | null>,
) {
  useFocusEffect(
    useCallback(() => {
      const frame = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({
          x: 0,
          y: 0,
          animated: false,
        });
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    }, [scrollRef]),
  );
}
