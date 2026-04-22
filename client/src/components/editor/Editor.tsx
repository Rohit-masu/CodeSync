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
import { autocompletion, closeBrackets } from "@codemirror/autocomplete"
import { bracketMatching } from "@codemirror/language"
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
import { generateCodeSuggestion } from "@/api/aiApi"

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
    const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false)

    const activeFileRef = useRef(activeFile)

    // Basic code formatting (simplified version without Prettier)
    const formatCode = useCallback(async () => {
        if (!activeFile || !canWrite || activeFile.content === undefined) return

        try {
            // Basic formatting based on language
            let formatted = activeFile.content
            
            if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'js') {
                // Basic JS formatting
                formatted = formatted
                    .replace(/;/g, ';\n')
                    .replace(/{/g, ' {\n    ')
                    .replace(/}/g, '\n}')
                    .replace(/\n\s*\n/g, '\n')
            } else if (language.toLowerCase() === 'json') {
                // Basic JSON formatting
                try {
                    const parsed = JSON.parse(formatted)
                    formatted = JSON.stringify(parsed, null, 4)
                } catch (e) {
                    toast.error('Invalid JSON format')
                    return
                }
            }

            if (formatted !== activeFile.content) {
                const updatedFile = { ...activeFile, content: formatted }
                setActiveFile(updatedFile)
                
                socket.emit(SocketEvent.FILE_UPDATED, {
                    fileId: activeFile.id,
                    newContent: formatted,
                })
                
                toast.success('Code formatted successfully')
            } else {
                toast('Code is already formatted')
            }
        } catch (error: any) {
            console.error('Formatting error:', error)
            toast.error(`Failed to format code: ${error.message}`)
        }
    }, [activeFile, canWrite, language, setActiveFile, socket])

    // Generate AI code suggestion
    const generateAISuggestion = useCallback(async () => {
        if (!activeFile || !canWrite || !editorRef.current?.view) {
            toast.error('Cannot generate suggestion: No active file or insufficient permissions')
            return
        }

        setIsGeneratingSuggestion(true)
        toast.loading('Generating AI suggestion...', { id: 'ai-suggestion' })

        try {
            const view = editorRef.current.view
            const cursorPosition = view.state.selection.main.head
            
            const suggestion = await generateCodeSuggestion(
                language,
                activeFile.content || '',
                cursorPosition
            )

            if (suggestion.trim()) {
                // Insert the suggestion at cursor position
                const transaction = view.state.update({
                    changes: {
                        from: cursorPosition,
                        to: cursorPosition,
                        insert: suggestion
                    },
                    selection: { anchor: cursorPosition + suggestion.length }
                })
                
                view.dispatch(transaction)
                toast.success('AI suggestion inserted', { id: 'ai-suggestion' })
            } else {
                toast('No suggestion available', { id: 'ai-suggestion' })
            }
        } catch (error: any) {
            console.error('AI suggestion error:', error)
            toast.error(`Failed to generate AI suggestion: ${error.message}`, { id: 'ai-suggestion' })
        } finally {
            setIsGeneratingSuggestion(false)
        }
    }, [activeFile, canWrite, language])

    // Keyboard shortcut handler for formatting (Ctrl+Shift+F or Cmd+Shift+F) and AI suggestions (Ctrl+Space or Cmd+Space)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Format code shortcut
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
                event.preventDefault()
                formatCode()
            }
            
            // AI suggestion shortcut
            if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
                event.preventDefault()
                generateAISuggestion()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [formatCode, generateAISuggestion])

    // Keep the ref updated with the latest activeFile
    useEffect(() => {
        activeFileRef.current = activeFile
    }, [activeFile])

    const onCodeChange = useCallback((code: string, view: ViewUpdate) => {
        const currentActiveFile = activeFileRef.current
        if (!currentActiveFile) return
        
        // Prevent infinite loops from programmatic updates (socket syncs)
        // If the code is the same as the current active file's content, it means
        // this change was triggered by the prop updating, not by the user typing.
        if (code === currentActiveFile.content) return

        // Verify this change was actually caused by a user input (typing, pasting, deleting, etc)
        // rather than a remote sync programmatically updating the Editor value
        const isUserInput = view.transactions.some(tr => 
            tr.isUserEvent("input") || 
            tr.isUserEvent("delete") || 
            tr.isUserEvent("undo") || 
            tr.isUserEvent("redo") || 
            tr.isUserEvent("paste") || 
            tr.isUserEvent("drop")
        )
        
        if (!isUserInput) return

        // canWrite check here is a safety net; real prevention is EditorState.readOnly below
        if (!canWrite) return

        const file: FileSystemItem = { ...currentActiveFile, content: code }
        setActiveFile(file)
        
        // Update local fileStructure
        // Note: updateFileContent should ideally be destructured from useFileSystem()
        // but since we only have activeFile/setActiveFile here, the context will handle 
        // updating openFiles via handleFileUpdated if needed, or we just rely on setActiveFile

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
            fileId: currentActiveFile.id,
            newContent: code,
        })
        clearTimeout(timeOut)
        const newTimeOut = setTimeout(
            () => socket.emit(SocketEvent.TYPING_PAUSE),
            1000,
        )
        setTimeOut(newTimeOut)
    }, [canWrite, socket, timeOut, setActiveFile])

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
            autocompletion({
                activateOnTyping: true,
                selectOnOpen: true,
                closeOnBlur: true,
                maxRenderedOptions: 10,
                defaultKeymap: true,
            }),
            closeBrackets(),
            bracketMatching(),
            collaborativeHighlighting(),
            EditorView.updateListener.of(handleSelectionChange),
            scrollPastEnd(),
            // ── FIX: EditorState.readOnly is the ONLY reliable way to block
            //         viewer edits at the CodeMirror level. The `editable` prop
            //         still allows programmatic changes; readOnly blocks them all.
            EditorState.readOnly.of(!canWrite),
        ]

        // Add error highlighting themes for JavaScript/TypeScript and Python
        if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript') {
            exts.push(
                EditorView.theme({
                    ".cm-diagnostic-error": {
                        borderLeft: "3px solid #f87171",
                        backgroundColor: "rgba(248, 113, 113, 0.1)",
                        padding: "0 0 0 3px",
                    },
                    ".cm-diagnostic-warning": {
                        borderLeft: "3px solid #fbbf24",
                        backgroundColor: "rgba(251, 191, 36, 0.1)",
                        padding: "0 0 0 3px",
                    },
                })
            )
        }

        if (language.toLowerCase() === 'python') {
            exts.push(
                EditorView.theme({
                    ".cm-diagnostic-error": {
                        borderLeft: "3px solid #f87171",
                        backgroundColor: "rgba(248, 113, 113, 0.1)",
                        padding: "0 0 0 3px",
                    },
                })
            )
        }

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
            {/* AI Suggestion Indicator */}
            {isGeneratingSuggestion && (
                <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-blue-600/80 px-3 py-1 text-xs text-white flex items-center gap-2">
                    <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full"></div>
                    🤖 AI thinking...
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