import { useAppContext } from "@/context/AppContext"
import useResponsive from "@/hooks/useResponsive"
import { ACTIVITY_STATE } from "@/types/app"
import DrawingEditor from "../drawing/DrawingEditor"
import EditorComponent from "../editor/EditorComponent"

function WorkSpace() {
    const { viewHeight } = useResponsive()
    const { activityState } = useAppContext()

    return (
        <div
            className="w-full max-w-full flex-grow overflow-x-hidden"
            style={{ height: viewHeight }}
        >
            {activityState === ACTIVITY_STATE.DRAWING ? (
                <DrawingEditor />
            ) : (
                <EditorComponent />
            )}
        </div>
    )
}

export default WorkSpace
