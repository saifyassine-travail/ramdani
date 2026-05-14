"use client"

import type React from "react"
import { useState } from "react"

import { useRouter } from "next/navigation"

interface PatientCardProps {
  name: string
  type: string
  status: string
  appointmentId: string | number
  patientId: number
  mutuelle?: boolean
  onStatusChange?: (id: string | number, newStatus: string) => void
  onMutuelleToggle?: (id: string | number) => void
  onDelete?: (id: string | number) => void
  onEdit?: (id: number) => void
}

export default function PatientCard({
  name,
  type,
  status,
  appointmentId,
  patientId,
  mutuelle = false,
  onStatusChange,
  onMutuelleToggle,
  onDelete,
  onEdit,
}: PatientCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const getStatusColors = (status: string) => {
    switch (status) {
      case "scheduled":
        return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" }
      case "waiting":
        return { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" }
      case "preparing":
        return { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" }
      case "consulting":
        return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" }
      case "completed":
        return { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" }
      case "canceled":
        return { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" }
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" }
    }
  }

  const colors = getStatusColors(status)

  const handleMutuelleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMutuelleToggle?.(appointmentId)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    // Validation is now handled by the parent component via AlertDialog
    onDelete?.(appointmentId)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    const id = typeof appointmentId === "string" ? Number.parseInt(appointmentId) : appointmentId
    onEdit?.(id)
  }

  return (
    <div
      className={`patient-card p-3 rounded-lg border ${colors.border} bg-white shadow-sm hover:shadow-md transition-shadow cursor-move ${isDeleting ? "opacity-50" : ""}`}
      data-appointment-id={appointmentId}
      data-status={status}
      draggable={!isDeleting}
    >
      <div className="flex items-center space-x-3">
        <div className={`w-1 h-8 ${colors.bg} rounded-full`}></div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{name}</h4>
            <div className="flex items-center space-x-2">
              <span className={`inline-block px-2 py-1 text-xs rounded-full ${colors.bg} ${colors.text}`}>{type}</span>
              <button
                onClick={handleEdit}
                className="inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                title="Modifier le rendez-vous"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/patients/${patientId}`)
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                title="Voir les détails du patient"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                title="Supprimer le rendez-vous"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
