import { useEffect, useState } from "react";

export default function useScrollSpy(ids: string[], scrollContainerId: string) {
  const [active, setActive] = useState(ids[0]);

  // Disable browser scroll restoration so refresh always starts at top
  useEffect(() => {
    history.scrollRestoration = "manual";
  }, []);

  // Intercept hash link clicks — scroll the right container, don't touch the URL
  useEffect(() => {
    const handleHashClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "A" && target.getAttribute("href")?.startsWith("#")) {
        e.preventDefault();
        const hash = target.getAttribute("href")?.slice(1);
        if (hash && ids.includes(hash)) {
          const el = document.getElementById(hash);
          const scrollContainer = document.getElementById(scrollContainerId);
          if (el && scrollContainer) {
            scrollContainer.scrollTo({ top: el.offsetTop - 100, behavior: "smooth" });
          }
        }
      }
    };

    document.addEventListener("click", handleHashClick);
    return () => document.removeEventListener("click", handleHashClick);
  }, [ids, scrollContainerId]);

  // Scroll detection for highlighting
  useEffect(() => {
    const scrollContainer = document.getElementById(scrollContainerId);
    if (!scrollContainer) return;

    const handleScroll = () => {
      const containerRect = scrollContainer.getBoundingClientRect();
      const isAtBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 10;

      let current = ids[0];

      if (isAtBottom) {
        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const elTop = el.getBoundingClientRect().top - containerRect.top;
          if (elTop < containerRect.height) {
            current = id;
          }
        });
      } else {
        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const elTop = el.getBoundingClientRect().top - containerRect.top;
          if (elTop <= 150) {
            current = id;
          }
        });
      }

      setActive(current);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [ids, scrollContainerId]);

  return active;
}