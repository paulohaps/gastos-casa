export function Icon({ name }: { name: string }) {
  return (
    <svg className="ui-icon" aria-hidden="true">
      <use href={"#i-" + name} />
    </svg>
  );
}
