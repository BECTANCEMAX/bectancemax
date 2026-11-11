import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import Home from "@/pages/Home";

// Le dashboard (GSAP, Framer Motion, date-fns) est chargé à part : l'accueil reste léger et rapide.
const Dashboard = lazy(() => import("@/pages/Dashboard"));

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/:view"
          element={
            <Suspense fallback={<div className="min-h-svh bg-black" />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
