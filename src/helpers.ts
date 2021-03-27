import { tap } from "rxjs/operators";

export function log<T>(description = '', badgeColor = 'darkCyan') {
  const badge = color => `background:${color}; color:white; padding:4px; margin-right:4px; border-radius:3px; font-size:9px;`;

  return tap<T>({
    next:  value => console.log(`%c${description}: ${value}`,  badge(badgeColor),  value),
    error: error => console.log(`%c${description} (error)`,    badge('fireBrick'), error),
    complete: () => console.log(`%c${description} (complete)`, badge('slateGray'))
  });
}
