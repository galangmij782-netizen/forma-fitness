import { createContext, useContext } from 'react'
export type PageKey = 'dashboard' | 'workouts' | 'splits' | 'meals' | 'progress' | 'settings'
export interface Nav { page: PageKey; go(p: PageKey, params?: Record<string, unknown>): void; params: Record<string, unknown> }
export const NavCtx = createContext<Nav>({ page: 'dashboard', go: () => {}, params: {} })
export const useNav = () => useContext(NavCtx)

export interface Session { profileId: string; name: string; color: string; lock(): void; refreshProfile(): void }
export const SessionCtx = createContext<Session>({ profileId: '', name: '', color: 'green', lock: () => {}, refreshProfile: () => {} })
export const useSession = () => useContext(SessionCtx)
