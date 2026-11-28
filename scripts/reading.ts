type ReadingLine = {actor: 'Pura' | 'Moko' | 'Stage'; text?: string};
type Blocks = Record<string, unknown>;
type MakeBlock = (
  opcode: string, next: string | null, parent: string | null,
  inputs?: object, fields?: object, topLevel?: boolean,
) => object;

export const advanceActor = 'AdvanceCue';
export const advanceArt = '<path d="M2 4h16l-8 10z" fill="#273963"/>';
const readAdvance = {VARIABLE: ['次へ進む', 'lessonReadAdvance']};
const clearMessage = 'reading:clear';
const clearId = 'lesson_read_clear';
const textInput = (text: string) => [1, [10, text]];
const numberInput = (value: number) => [1, [4, String(value)]];

/** Story actions wait for the native Scratch reader input and clear the visible bubble. */
export function createReadingPacing(block: MakeBlock) {
  const lines: ReadingLine[] = [];

  function wait(actor: ReadingLine['actor'], text?: string) {
    const previous = lines.findIndex(line => line.actor === actor && line.text === text);
    const index = previous < 0 ? lines.push({actor, text}) - 1 : previous;
    return [
      {broadcastMessageAndWait: 'reading:' + index},
      {broadcastMessageAndWait: clearMessage},
    ];
  }

  function install(name: string, blocks: Blocks) {
    const isStage = name === 'Stage';
    if (isStage || name === 'Pura' || name === 'Moko' || name === advanceActor) {
      blocks.readerClick = {
        ...block(isStage ? 'event_whenstageclicked' : 'event_whenthisspriteclicked',
          'readerAdvance', null, {}, {}, true),
        x: 650, y: 45,
      };
      blocks.readerAdvance = block('data_setvariableto', null, 'readerClick', {VALUE: numberInput(1)}, readAdvance);
    }

    if (isStage || name === 'Pura' || name === 'Moko') {
      blocks.readerClear = {
        ...block('event_whenbroadcastreceived', 'readerClearDone', null, {},
          {BROADCAST_OPTION: [clearMessage, clearId]}, true),
        x: 650, y: 185,
      };
      blocks.readerClearDone = isStage
        ? block('data_setvariableto', null, 'readerClear', {VALUE: numberInput(1)}, readAdvance)
        : block('looks_say', null, 'readerClear', {MESSAGE: textInput('')});
    }

    for (const [index, line] of lines.entries()) {
      if (line.actor !== name) continue;
      const hat = 'reading_' + index;
      const reset = hat + '_reset', say = hat + '_say', pause = hat + '_wait';
      const condition = hat + '_condition', input = hat + '_input';
      blocks[hat] = {
        ...block('event_whenbroadcastreceived', reset, null, {},
          {BROADCAST_OPTION: ['reading:' + index, hat]}, true),
        x: 2450 + 360 * Math.floor(index / 12), y: 40 + 195 * (index % 12),
      };
      blocks[reset] = block('data_setvariableto', line.text === undefined ? pause : say,
        hat, {VALUE: numberInput(0)}, readAdvance);
      if (line.text !== undefined) {
        blocks[say] = block('looks_say', pause, reset, {MESSAGE: textInput(line.text)});
      }
      blocks[pause] = block('control_wait_until', null, line.text === undefined ? reset : say,
        {CONDITION: [2, condition]});
      blocks[condition] = block('operator_equals', null, pause,
        {OPERAND1: [3, input, [4, '0']], OPERAND2: numberInput(1)});
      blocks[input] = block('data_variable', null, condition, {}, readAdvance);
    }

    if (name !== advanceActor) return;
    const ghost = {EFFECT: ['GHOST', null]};
    blocks.blinkStart = block('event_whenflagclicked', 'blink', null, {}, {}, true);
    blocks.blink = block('control_forever', null, 'blinkStart', {SUBSTACK: [2, 'lit']});
    blocks.lit = block('looks_seteffectto', 'visiblePause', 'blink', {VALUE: numberInput(0)}, ghost);
    blocks.visiblePause = block('control_wait', 'dim', 'lit', {DURATION: numberInput(0.55)});
    blocks.dim = block('looks_seteffectto', 'dimPause', 'visiblePause', {VALUE: numberInput(80)}, ghost);
    blocks.dimPause = block('control_wait', null, 'dim', {DURATION: numberInput(0.55)});
  }

  function installStage(stage: {blocks: Blocks; variables: Blocks; broadcasts: Blocks}) {
    stage.variables.lessonReadAdvance = ['次へ進む', 0];
    stage.broadcasts[clearId] = clearMessage;
    for (let index = 0; index < lines.length; index++) {
      stage.broadcasts['reading_' + index] = 'reading:' + index;
    }
    install('Stage', stage.blocks);
  }

  return {wait, install, installStage};
}
