'use client';

import { useState, useRef, useEffect } from 'react';
import type { HeroFacet } from '../lib/store';

// Map API color names → CSS hex values
const FACET_COLORS: Record<string, string> = {
    Red: '#c94242',
    Blue: '#4290c9',
    Green: '#42c96a',
    Purple: '#9042c9',
    Yellow: '#c9aa42',
    Gray: '#7a7a7a',
};

interface FacetPickerProps {
    /** Hero's available (non-deprecated) facets */
    facets: HeroFacet[];
    /** Currently selected facet index */
    selectedFacetId: number;
    /** Called when user picks a different facet */
    onChange: (facetId: number) => void;
}

/**
 * FacetPicker — compact badge + popover to select a hero's active facet.
 *
 * Renders as a small coloured pill below the hero portrait. Clicking it
 * opens an inline popover listing all available facets with title and
 * one-line description. Closes on outside click or Escape.
 */
export default function FacetPicker({ facets, selectedFacetId, onChange }: FacetPickerProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selectedFacet = facets[selectedFacetId] ?? facets[0];
    if (!selectedFacet) return null;

    const color = FACET_COLORS[selectedFacet.color] ?? '#7a7a7a';

    // Close popover when clicking outside
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', keyHandler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', keyHandler);
        };
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
            {/* ── Facet badge ─────────────────────────────────────────────── */}
            <button
                onClick={() => setOpen((v) => !v)}
                title={`Facet: ${selectedFacet.title} — click to change`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: `1.5px solid ${color}`,
                    background: `${color}22`,
                    color,
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    lineHeight: 1.4,
                    letterSpacing: '0.03em',
                    transition: 'background 0.15s',
                    whiteSpace: 'nowrap',
                    maxWidth: '90px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span style={{ fontSize: '7px' }}>◈</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedFacet.title}
                </span>
            </button>

            {/* ── Popover ──────────────────────────────────────────────────── */}
            {open && (
                <div
                    role="listbox"
                    aria-label="Select facet"
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 6px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100,
                        width: '220px',
                        background: '#141a24',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                        overflow: 'hidden',
                    }}
                >
                    <p style={{
                        margin: 0,
                        padding: '8px 10px 4px',
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: 'rgba(255,255,255,0.35)',
                    }}>
                        Choose Facet
                    </p>

                    {facets.map((facet) => {
                        const fc = FACET_COLORS[facet.color] ?? '#7a7a7a';
                        const isSelected = facet.id === selectedFacetId;
                        return (
                            <button
                                key={facet.id}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                    onChange(facet.id);
                                    setOpen(false);
                                }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '8px 10px',
                                    background: isSelected ? `${fc}20` : 'transparent',
                                    borderLeft: isSelected ? `3px solid ${fc}` : '3px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'background 0.1s',
                                    border: 'none',
                                    borderLeftWidth: '3px',
                                    borderLeftStyle: 'solid',
                                    borderLeftColor: isSelected ? fc : 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background = `${fc}18`;
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background =
                                        isSelected ? `${fc}20` : 'transparent';
                                }}
                            >
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: fc,
                                    marginBottom: '2px',
                                }}>
                                    {facet.title}
                                </div>
                                <div style={{
                                    fontSize: '10px',
                                    color: 'rgba(255,255,255,0.55)',
                                    lineHeight: 1.4,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}>
                                    {facet.description}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
