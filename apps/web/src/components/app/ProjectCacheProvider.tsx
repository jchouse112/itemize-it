"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { IIProject } from "@/lib/ii-types";

interface ProjectCacheContextValue {
  projects: IIProject[];
  loaded: boolean;
  ensureLoaded: () => void;
}

const ProjectCacheContext = createContext<ProjectCacheContextValue>({
  projects: [],
  loaded: false,
  ensureLoaded: () => {},
});

export function ProjectCacheProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<IIProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(false);

  const ensureLoaded = useCallback(() => {
    if (loaded || fetching) return;
    setFetching(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(
          (data.projects ?? []).filter(
            (p: IIProject) => p.status === "active"
          )
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true))
      .finally(() => setFetching(false));
  }, [loaded, fetching]);

  // Pre-fetch projects on mount so they're ready when dropdown opens
  useEffect(() => {
    ensureLoaded();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProjectCacheContext.Provider value={{ projects, loaded, ensureLoaded }}>
      {children}
    </ProjectCacheContext.Provider>
  );
}

export function useProjectCache() {
  return useContext(ProjectCacheContext);
}
