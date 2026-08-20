"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function SiteShell({ navigation, searchIndex, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sideOpen, setSideOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openChapters, setOpenChapters] = useState(new Set());

  useEffect(() => {
    if (localStorage.getItem("splus_theme") === "dark") document.body.classList.add("dark");
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(q)).slice(0, 10);
  }, [query, searchIndex]);

  function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem("splus_theme", document.body.classList.contains("dark") ? "dark" : "light");
  }

  function goResult(item) {
    setQuery("");
    const hash = item.sectionNumber ? `#section-${item.lessonId}-${item.sectionNumber}` : "";
    router.push(`/course/${item.lessonId}${hash}`);
  }

  const active = (path) => pathname === path || (path !== "/" && pathname.startsWith(path));

  return <>
    <header className="top">
      <button className="icon mobile" onClick={() => setSideOpen((v) => !v)} aria-label="Toggle navigation">☰</button>
      <Link href="/" className="logo">S+</Link>
      <div className="brand"><strong>Security+ Study Guide</strong><small>Created by: Ariana Herrera</small></div>
      <div className="search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search every lesson and learning section…" />
        {!!results.length && <div className="search-popover">{results.map((item, i) => <button key={`${item.lessonId}-${item.sectionNumber}-${i}`} onClick={() => goResult(item)}><strong>{item.title}</strong><span>{item.subtitle}</span></button>)}</div>}
      </div>
      <button className="icon" onClick={toggleTheme} aria-label="Toggle dark mode">◐</button>
    </header>
    <div className="layout">
      <aside className={`side ${sideOpen ? "open" : ""}`}>
        <Link className={`nav ${active("/") && pathname === "/" ? "active" : ""}`} href="/">Home</Link>
        <Link className={`nav ${active("/course") ? "active" : ""}`} href="/course">Full Course</Link>
        <Link className={`nav ${active("/flashcards") ? "active" : ""}`} href="/flashcards">Course Flashcards</Link>
        <Link className={`nav ${active("/quiz") ? "active" : ""}`} href="/quiz">Scenario Quiz</Link>
        <div className="side-title">Uploaded Chapters</div>
        {navigation.map((chapter) => {
          const open = openChapters.has(chapter.chapter);
          return <div className={`chapter-nav ${open ? "open" : ""}`} key={chapter.chapter}>
            <button onClick={() => setOpenChapters((current) => { const next = new Set(current); next.has(chapter.chapter) ? next.delete(chapter.chapter) : next.add(chapter.chapter); return next; })}>Chapter {chapter.chapter}: {chapter.name}</button>
            <div className="lesson-links">{chapter.lessons.map((lesson) => <Link key={lesson.id} href={`/course/${lesson.id}`}>{lesson.id} {lesson.title}</Link>)}</div>
          </div>;
        })}
      </aside>
      <main className="main">{children}</main>
    </div>
  </>;
}
