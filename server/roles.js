/* Roles y permisos. Para cambiar quién puede qué, se edita solo esta tabla.
   Permisos "build:*" se aplican SOLO sobre publicaciones propias (ver canOn). */
export const ROLES={
  admin:{label:'Administrador',can:['textures:update']},                          // solo texturas globales
  user:{label:'Usuario',can:['build:create','build:edit','build:delete']},         // sube, edita y borra lo suyo
};
export const can=(user,perm)=>!!user&&!!ROLES[user.role]&&ROLES[user.role].can.includes(perm);
/* Permiso sobre un recurso concreto: además de tener el permiso, debe ser el dueño. */
export const canOn=(user,perm,build)=>can(user,perm)&&!!build&&build.ownerId===user.id;
