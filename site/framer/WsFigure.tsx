// Framer code component: paste into a Framer project as a code file.
// It loads the figure's self-contained module from the Vercel deployment and renders <ws-figure>.
// Properties: figure name, theme, the challenge to open first, and an optional caption override.
import { useEffect } from "react"
import { addPropertyControls, ControlType } from "framer"

const BASE = "https://YOUR-VERCEL-DEPLOYMENT.vercel.app" // set once to the deployed site/dist

type Props = { name: string; theme: "auto" | "light" | "dark"; challenge: number; caption: string; base: string }

export default function WsFigure({ name, theme, challenge, caption, base }: Props) {
    useEffect(() => {
        import(/* @vite-ignore */ `${base || BASE}/${name}.js`).catch((error) => console.error("ws-figure:", error))
    }, [name, base])
    const attrs: Record<string, string> = { name, theme }
    if (challenge > 0) attrs.challenge = String(challenge)
    if (caption) attrs.caption = caption
    // @ts-expect-error custom element
    return <ws-figure key={`${name}-${theme}-${challenge}`} {...attrs} style={{ display: "block", width: "100%" }} />
}

WsFigure.defaultProps = { name: "f1-t-position", theme: "auto", challenge: 0, caption: "", base: "" }

addPropertyControls(WsFigure, {
    name: { type: ControlType.Enum, title: "Figure", options: ["f1-t-position", "f2-uphaul", "f3-base-position"], optionTitles: ["F1 T-position", "F2 Uphaul load", "F3 Base position"] },
    theme: { type: ControlType.Enum, title: "Theme", options: ["auto", "light", "dark"] },
    challenge: { type: ControlType.Number, title: "Open challenge", min: 0, max: 5, step: 1, displayStepper: true },
    caption: { type: ControlType.String, title: "Caption", placeholder: "Leave empty for the figure's own" },
    base: { type: ControlType.String, title: "Module URL", placeholder: BASE },
})
