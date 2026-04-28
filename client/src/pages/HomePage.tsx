import illustration from "@/assets/illustration.svg"
import FormComponent from "@/components/forms/FormComponent"

function HomePage() {
    return (
        <div className="min-h-screen bg-dark text-white">
            <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-4">
                <div className="relative flex flex-col justify-center overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(57,224,121,0.18),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.03),_rgba(255,255,255,0.01))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-10 lg:px-12">
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
                    <div className="relative z-10 max-w-xl">
                        <div className="mb-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                            Real-time collaborative coding
                        </div>
                        <h1 className="max-w-lg text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.8rem]">
                            Code together in a room that feels ready before the editor even opens.
                        </h1>
                        <p className="mt-4 max-w-xl text-sm leading-6 text-gray-300 sm:text-[15px]">
                            Create a room, share the invite in one tap, and bring your team into the same code workspace with chat, files, drawing, and live collaboration.
                        </p>
                        <div className="mt-6 grid gap-3 text-sm text-gray-200 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                                <div className="text-2xl font-semibold text-primary">Live</div>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">Collaboration</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                                <div className="text-2xl font-semibold text-primary">Room</div>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">Approval flow</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                                <div className="text-2xl font-semibold text-primary">Built</div>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">For student demos</p>
                            </div>
                        </div>
                    </div>
                    <div className="relative z-10 mt-6 flex justify-center lg:mt-4 lg:justify-end">
                        <img
                            src={illustration}
                            alt="Code Sync Illustration"
                            className="w-full max-w-[320px] animate-up-down drop-shadow-[0_20px_35px_rgba(0,0,0,0.45)] sm:max-w-[360px] lg:max-w-[380px]"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-center py-1 lg:py-3">
                    <FormComponent />
                </div>
            </div>
        </div>
    )
}

export default HomePage
