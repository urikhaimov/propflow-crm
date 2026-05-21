'use client'
// store/crm.ts
import { create } from 'zustand'
import type { Lead, Property, Agent, Notification, LeadFilters } from '@/types'

interface CRMStore {
  // Data
  leads: Lead[]
  properties: Property[]
  agents: Agent[]
  notifications: Notification[]

  // UI State
  selectedLead: Lead | null
  selectedProperty: Property | null
  filters: LeadFilters
  searchQuery: string
  sidebarOpen: boolean
  detailPanelOpen: boolean

  // Loading states
  leadsLoading: boolean
  propertiesLoading: boolean

  // Actions
  setLeads: (leads: Lead[]) => void
  setProperties: (properties: Property[]) => void
  setAgents: (agents: Agent[]) => void
  setNotifications: (notifications: Notification[]) => void
  setSelectedLead: (lead: Lead | null) => void
  setSelectedProperty: (property: Property | null) => void
  setFilters: (filters: LeadFilters) => void
  setSearchQuery: (query: string) => void
  setSidebarOpen: (open: boolean) => void
  setDetailPanelOpen: (open: boolean) => void
  setLeadsLoading: (loading: boolean) => void
  setPropertiesLoading: (loading: boolean) => void
  updateLead: (id: string, updates: Partial<Lead>) => void
  addLead: (lead: Lead) => void
  removeLead: (id: string) => void
  markNotificationRead: (id: string) => void
  unreadCount: () => number
}

export const useCRMStore = create<CRMStore>((set, get) => ({
  leads: [],
  properties: [],
  agents: [],
  notifications: [],
  selectedLead: null,
  selectedProperty: null,
  filters: {},
  searchQuery: '',
  sidebarOpen: true,
  detailPanelOpen: false,
  leadsLoading: false,
  propertiesLoading: false,

  setLeads: (leads) => set({ leads }),
  setProperties: (properties) => set({ properties }),
  setAgents: (agents) => set({ agents }),
  setNotifications: (notifications) => set({ notifications }),
  setSelectedLead: (lead) => set({ selectedLead: lead, detailPanelOpen: !!lead }),
  setSelectedProperty: (property) => set({ selectedProperty: property }),
  setFilters: (filters) => set({ filters }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setDetailPanelOpen: (detailPanelOpen) => set({ detailPanelOpen }),
  setLeadsLoading: (leadsLoading) => set({ leadsLoading }),
  setPropertiesLoading: (propertiesLoading) => set({ propertiesLoading }),

  updateLead: (id, updates) => set(state => ({
    leads: state.leads.map(l => l.id === id ? { ...l, ...updates } : l),
    selectedLead: state.selectedLead?.id === id ? { ...state.selectedLead, ...updates } : state.selectedLead,
  })),

  addLead: (lead) => set(state => ({ leads: [lead, ...state.leads] })),

  removeLead: (id) => set(state => ({
    leads: state.leads.filter(l => l.id !== id),
    selectedLead: state.selectedLead?.id === id ? null : state.selectedLead,
    detailPanelOpen: state.selectedLead?.id === id ? false : state.detailPanelOpen,
  })),

  markNotificationRead: (id) => set(state => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
  })),

  unreadCount: () => get().notifications.filter(n => !n.is_read).length,
}))
