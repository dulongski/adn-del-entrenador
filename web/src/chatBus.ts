/** Estado que el chat de IA deja para otras vistas (p.ej. el segundo DT de «Cara a cara»). Se consume una vez. */
export const chatBus: { vsRival: number | null; jug: { club: string; f?: string } | null } = { vsRival: null, jug: null }
