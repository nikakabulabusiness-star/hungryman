import type {ReactNode} from 'react';
import './system.css';
// Keep one importer of system.css. When several client modules import the same
// stylesheet, the bundler emits a CSS-only shared chunk whose JS file is dropped
// but still listed in the RSC asset manifest, so every visit 404s on it.
export default function SystemSection({children}:{children:ReactNode}){return <section className="system-console">{children}</section>}
