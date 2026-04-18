import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import { useSettings } from "@/context/SettingContext"
import { useSocket } from "@/context/SocketContext"
import usePageEvents from "@/hooks/usePageEvents"
import { editorThemes } from "@/resources/Themes"
import { FileSystemItem } from "@/types/file"
import { SocketEvent } from "@/types/socket"
import { color } from "@uiw/codemirror-extensions-color"
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link"
import { LanguageName, loadLanguage } from "@uiw/codemirror-extensions-langs"
import CodeMirror, {
    Extension,
    ViewUpdate,
    scrollPastEnd,
} from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import toast from "react-hot-toast"
import { collaborativeHighlighting, updateRemoteUsers } from "./collaborativeHighlighting"

function Editor() {
    const { users, currentUser } = useAppContext()
    const { activeFile, setActiveFile } = useFileSystem()
    const { theme, language, fontSize } = useSettings()
    const { socket } = useSocket()
        const [timeOut, setTimeOut] = useState(setTimeout(() => {}, 0))

    // ── FIX: derive canWrite from role — single source of truth ──────────────
    const canWrite = currentUser.role === "HOST" || currentUser.role === "EDITOR"

    const filteredUsers = useMemo(
        () => users.filter((u) => u.username !== currentUser.username),
        [users, currentUser],
    )

    const [extensions, setExtensions] = useState<Extension[]>([])
    const editorRef = useRef<any>(null)
    const [lastCursorPosition, setLastCursorPosition] = useState<number>(0)
    const [lastSelection, setLastSelection] = useState<{
        start?: number
        end?: number
    }>({})
    const cursorMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const onCodeChange = (code: string, view: ViewUpdate) => {
        if (!activeFile) return
        // canWrite check here is a safety net; real prevention is EditorState.readOnly below
        if (!canWrite) return

        const file: FileSystemItem = { ...activeFile, content: code }
        setActiveFile(file)

        const selection = view.state?.selection?.main
        const cursorPosition = selection?.head || 0
        const selectionStart = selection?.from
        const selectionEnd = selection?.to

        socket.emit(SocketEvent.TYPING_START, {
            cursorPosition,
            selectionStart,
            selectionEnd,
        })
        socket.emit(SocketEvent.FILE_UPDATED, {
            fileId: activeFile.id,
            newContent: code,
        })
        clearTimeout(timeOut)
        const newTimeOut = setTimeout(
            () => socket.emit(SocketEvent.TYPING_PAUSE),
            1000,
        )
        setTimeOut(newTimeOut)
    }

    const handleSelectionChange = useCallback(
        (view: ViewUpdate) => {
            if (!view.selectionSet) return

            const selection = view.state?.selection?.main
            const cursorPosition = selection?.head || 0
            const selectionStart = selection?.from
            const selectionEnd = selection?.to

            const cursorChanged = cursorPosition !== lastCursorPosition
            const selectionChanged =
                selectionStart !== lastSelection.start ||
                selectionEnd !== lastSelection.end

            if (cursorChanged || selectionChanged) {
                setLastCursorPosition(cursorPosition)
                setLastSelection({ start: selectionStart, end: selectionEnd })

                if (cursorMoveTimeoutRef.current) {
                    clearTimeout(cursorMoveTimeoutRef.current)
                }
                cursorMoveTimeoutRef.current = setTimeout(() => {
                    socket.emit(SocketEvent.CURSOR_MOVE, {
                        cursorPosition,
                        selectionStart,
                        selectionEnd,
                    })
                }, 100)
            }
        },
        [lastCursorPosition, lastSelection, socket],
    )

    usePageEvents()

    useEffect(() => {
        const exts: Extension[] = [
            color,
            hyperLink,
            collaborativeHighlighting(),
            EditorView.updateListener.of(handleSelectionChange),
            scrollPastEnd(),
            // ── FIX: EditorState.readOnly is the ONLY reliable way to block
            //         viewer edits at the CodeMirror level. The `editable` prop
            //         still allows programmatic changes; readOnly blocks them all.
            EditorState.readOnly.of(!canWrite),
        ]

        const langExt = loadLanguage(language.toLowerCase() as LanguageName)
        if (langExt) {
            exts.push(langExt)
        } else {
            toast.error(
                "Syntax highlighting is unavailable for this language. Please adjust the editor settings; it may be listed under a different name.",
                { duration: 5000 },
            )
        }

        setExtensions(exts)
    }, [filteredUsers, language, handleSelectionChange, canWrite])
    // ── FIX: canWrite added to deps so readOnly updates when role changes ────

    useEffect(() => {
        if (editorRef.current?.view) {
            editorRef.current.view.dispatch({
                effects: updateRemoteUsers.of(filteredUsers),
            })
        }
    }, [filteredUsers])

    return (
        <div className="relative flex flex-col flex-grow">
            {/* ── FIX: visual indicator so viewer knows why they can't type ── */}
            {!canWrite && (
                <div className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-black/60 px-2 py-1 text-xs text-gray-300">
                    👁 View only
                </div>
            )}
            <CodeMirror
                ref={editorRef}
                theme={editorThemes[theme]}
                onChange={onCodeChange}
                value={activeFile?.content}
                extensions={extensions}
                // editable=false hides the cursor; readOnly (above) blocks input
                editable={canWrite}
                minHeight="100%"
                maxWidth="100vw"
                style={{
                    fontSize: fontSize + "px",
                    height: "100%",
                }}
            />
        </div>
    )
}

export default Editor