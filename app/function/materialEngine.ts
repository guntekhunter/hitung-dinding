export function countPanels(
    areaM2: number,
    panelWidthM: number,
    panelLengthM: number,
    waste = 0.1
) {
    const panelArea = panelWidthM * panelLengthM;
    return Math.ceil((areaM2 / panelArea) * (1 + waste));
}

export function countBoards(
    perimeterM: number,
    boardLengthM: number,
    waste = 0.05
) {
    return Math.ceil((perimeterM / boardLengthM) * (1 + waste));
}
