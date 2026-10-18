/** Read-only deadline: never retry or time out a write with an uncertain result. */
export async function editorialReadDeadline<T>(read: PromiseLike<T>, phase: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(read),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `La lectura de ${phase} en DEV superó 15 segundos. Puedes crear un borrador o actualizar de nuevo; no se realizó ninguna escritura.`,
              ),
            ),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
