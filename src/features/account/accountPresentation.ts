export const roleNames: Record<string, string> = { admin: '平台管理员', operator: '运营人员', member: '普通用户', owner: '负责人', manager: '管理员', editor: '编辑者', viewer: '查看者' };
export const kindNames = { publisher: '发布人', contractor: '承接人' };
export const timeText = (value: string) => value.replace('T', ' ').slice(0, 16);
