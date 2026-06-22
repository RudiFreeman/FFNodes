// Подстановка реальных выходных путей вместо плейсхолдеров в аргументах команды.
// Мульти-аутпут (Спринт 3): генератор кладёт в args плейсхолдеры (output_0.mp4…), фронт
// после save-диалогов заменяет каждый на выбранный путь. Чистая функция — тестируемо.

// args — аргументы команды с плейсхолдерами; placeholders[i] заменяется на chosen[i]
// (точное совпадение элемента массива). Прочие аргументы не трогаем.
export function substituteOutputs(
  args: string[],
  placeholders: string[],
  chosen: string[],
): string[] {
  return args.map((a) => {
    const idx = placeholders.indexOf(a);
    return idx >= 0 ? chosen[idx] ?? a : a;
  });
}
