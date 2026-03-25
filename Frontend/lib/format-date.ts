import { format, parseISO } from "date-fns"
import { fr, enUS, ar } from "date-fns/locale"

export function getGlobalDateFormat(): string {
    if (typeof window === "undefined") return "dd/MM/yyyy"

    try {
        const settingsStr = localStorage.getItem("app_settings")
        if (settingsStr) {
            const settings = JSON.parse(settingsStr)
            if (settings.date_format) {
                // Convert the UI format strings to date-fns format strings
                if (settings.date_format === "DD/MM/YYYY") return "dd/MM/yyyy"
                if (settings.date_format === "MM/DD/YYYY") return "MM/dd/yyyy"
                if (settings.date_format === "YYYY-MM-DD") return "yyyy-MM-dd"
            }
        }
    } catch (e) {
        console.warn("Failed to parse app settings from local storage")
    }
    return "dd/MM/yyyy"
}

export function getGlobalLocale() {
    if (typeof window === "undefined") return fr

    try {
        const settingsStr = localStorage.getItem("app_settings")
        if (settingsStr) {
            const settings = JSON.parse(settingsStr)
            if (settings.language === "en") return enUS
            if (settings.language === "ar") return ar
        }
    } catch (e) {
        console.warn("Failed to parse app settings from local storage")
    }
    return fr
}

export function formatGlobalDate(dateString: string | Date | null | undefined): string {
    if (!dateString) return ""

    try {
        const date = typeof dateString === "string" ? parseISO(dateString) : dateString

        // In case parseISO failed or Invalid Date
        if (isNaN(date.getTime())) return ""

        const formatStr = getGlobalDateFormat()
        const locale = getGlobalLocale()

        return format(date, formatStr, { locale })
    } catch (e) {
        // Fallback if parsing fails (e.g., standard browser dates instead of ISO)
        try {
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return ""
            return format(date, getGlobalDateFormat(), { locale: getGlobalLocale() })
        } catch {
            return ""
        }
    }
}
