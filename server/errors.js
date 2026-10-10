export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
export const httpError=(status,message)=>new HttpError(status,message);
/* Errores del almacenamiento (independientes de HTTP): EXISTS | CONFLICT | NOT_FOUND */
export class StoreError extends Error{constructor(code,message){super(message||code);this.code=code}}
