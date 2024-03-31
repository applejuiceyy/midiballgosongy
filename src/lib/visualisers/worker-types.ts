export interface W2OMidi {
    type: "midi",
    id: string,
    data: any
}

export interface W2OCancel {
    type: "cancel"
}

export type W2OLongHaulRequest = (W2OMidi | W2OCancel) & {
    ticket: number
}

export interface O2WLongHaulResult {
    type: "result",
    data: any
}

export interface O2WLongHaulCancel {
    type: "cancel"
}

export interface O2WLongHaulProgress {
    type: "progress",
    progress: number | null,
    action: string
}

export type O2WLongHaul = (O2WLongHaulProgress | O2WLongHaulResult | O2WLongHaulCancel) & {
    ticket: number
}

export type W2OMessage = W2OLongHaulRequest
export type O2WMessage = O2WLongHaul