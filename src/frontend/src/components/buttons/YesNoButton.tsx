import { t } from '@lingui/macro';
import { Badge, type MantineColor, Skeleton } from '@mantine/core';

import { isTrue } from '../../functions/conversion';

export function PassFailButton({
  value,
  passText,
  failText,
  passColor,
  failColor
}: Readonly<{
  value: any;
  passText?: string;
  failText?: string;
  passColor?: MantineColor;
  failColor?: MantineColor;
}>) {
  const v = isTrue(value);
  const pass = passText ?? t`Pass`;
  const fail = failText ?? t`Fail`;

  const pColor = passColor ?? 'lime.5';
  const fColor = failColor ?? 'red.6';

  return (
    <Badge
      color={v ? pColor : fColor}
      variant='filled'
      radius='lg'
      size='sm'
      style={{ maxWidth: '50px' }}
    >
      {v ? pass : fail}
    </Badge>
  );
}

export function YesNoButton({ value }: Readonly<{ value: any }>) {
  return (
    <PassFailButton
      value={value}
      passText={t`Yes`}
      failText={t`No`}
      failColor={'orange.6'}
    />
  );
}

export function YesNoUndefinedButton({ value }: Readonly<{ value?: boolean }>) {
  if (value === undefined) {
    return <Skeleton height={15} width={32} />;
  } else {
    return <YesNoButton value={value} />;
  }
}
