/** 对外编号与内部userNo分离；旧服务的数字编号仅用于兼容显示。 */
export function memberNumber(user: { userNo: string; memberNo?: string | null }): string {
  if (user.memberNo) return user.memberNo;
  const match = /^(?:USER|MEM)-(\d+)$/i.exec(user.userNo);
  return match ? `MEM-${match[1].replace(/^0+(?=\d)/, '').padStart(6, '0')}` : '编号待同步';
}

/** 审计保留原始内容，展示时统一历史数字账号的称呼。 */
export const memberReferenceText = (value: string) =>
  value.replace(
    /\bUSER-(\d+)\b/gi,
    (_, digits: string) => `MEM-${digits.replace(/^0+(?=\d)/, '').padStart(6, '0')}`,
  );
