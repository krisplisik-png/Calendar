export function humanizeFirebaseError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Неверный email или пароль.',
    'auth/invalid-email': 'Проверьте формат email.',
    'auth/user-disabled': 'Эта учётная запись отключена.',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже.',
    'permission-denied': 'Недостаточно прав для доступа к данным школы.',
    'firestore/permission-denied': 'Недостаточно прав для доступа к данным школы.',
    unavailable: 'Нет связи с Firebase. Проверьте интернет.',
    'firestore/unavailable': 'Нет связи с Firebase. Проверьте интернет.',
  };
  return messages[code] ?? 'Не удалось выполнить операцию. Проверьте соединение и повторите попытку.';
}
