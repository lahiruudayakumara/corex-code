import { Text, useInput } from "ink";

type TextAreaProps = {
  value: string;
  onChange(value: string): void;
  onSubmit(value: string): void;
  onHistory(direction: -1 | 1): void;
  placeholder: string;
  isActive: boolean;
  disabled?: boolean;
};

export function TextArea({
  value,
  onChange,
  onSubmit,
  onHistory,
  placeholder,
  isActive,
  disabled = false,
}: TextAreaProps) {
  useInput(
    (input, key) => {
      if (disabled) return;
      if (key.return) {
        if (key.shift || key.meta) {
          onChange(`${value}\n`);
        } else if (value.trim()) {
          onSubmit(value);
        }
        return;
      }
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (key.upArrow && !value.includes("\n")) {
        onHistory(-1);
        return;
      }
      if (key.downArrow && !value.includes("\n")) {
        onHistory(1);
        return;
      }
      if (key.escape) {
        onChange("");
        return;
      }
      if (!key.ctrl && !key.tab && input) {
        onChange(`${value}${input}`.slice(0, 8_000));
      }
    },
    { isActive },
  );

  if (!value) {
    return <Text dimColor>{placeholder}</Text>;
  }

  return (
    <Text>
      {value}
      <Text inverse> </Text>
    </Text>
  );
}
