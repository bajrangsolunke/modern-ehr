// ScribePage removed — ambient scribe is now embedded in SoapNotePage
// via features/notes/components/RecordingPanel.
// Hooks and components are still exported for reuse.
export { useScribeSession, usePatientScribeSessions } from "./hooks/use-scribe";
export { useStreamingSession } from "./hooks/use-streaming-session";
export { useRecorder } from "./hooks/use-recorder";
export { Waveform } from "./components/Waveform";
export { PipelineStrip } from "./components/PipelineStrip";
export { IcdSuggestionsList } from "./components/IcdSuggestionsList";
export { SummaryCard } from "./components/SummaryCard";
