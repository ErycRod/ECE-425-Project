import { useEffect, useState } from "react";

// The pages of the site. Each learning level is labelled with the Bloom's
// Taxonomy levels it targets (Remember → Create).
export const PAGES = [
  {
    key: "home",
    name: "Home",
    icon: "sparkle",
    bloom: "Start here",
  },
  {
    key: "beginner",
    name: "Beginner",
    icon: "book",
    bloom: "Remember · Understand",
    goal: "Learn what each part of the model does and how a systolic array multiplies matrices.",
  },
  {
    key: "intermediate",
    name: "Intermediate",
    icon: "gauge",
    bloom: "Apply · Analyze",
    goal: "Change the array size, bits and bandwidth, finish the tasks, and explain what limits the speed.",
  },
  {
    key: "advanced",
    name: "Advanced",
    icon: "cpu",
    bloom: "Evaluate · Create",
    goal: "Build your own accelerator, generate its Verilog and compare it with the 9 synthesized designs.",
  },
  {
    key: "code",
    name: "Code",
    icon: "code",
    bloom: "Under the hood",
    goal: "See the Verilog, the roofline math and the raw data behind every number.",
  },
];

export function findPage(key) {
  for (let i = 0; i < PAGES.length; i++) {
    if (PAGES[i].key === key) {
      return PAGES[i];
    }
  }
  return PAGES[0];
}

// "#/intermediate" -> "intermediate"; anything unknown -> "home"
export function pageFromHash(hash) {
  const key = (hash || "").replace(/^#\/?/, "");
  return findPage(key).key;
}

// Current page, kept in the address bar (#/beginner, ...) so the browser's
// back button and bookmarks work. No router package needed.
export function usePage() {
  const [page, setPage] = useState(pageFromHash(window.location.hash));

  useEffect(() => {
    function handleHashChange() {
      setPage(pageFromHash(window.location.hash));
      window.scrollTo(0, 0);
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function goTo(key) {
    window.location.hash = "#/" + key;
  }

  return [page, goTo];
}
