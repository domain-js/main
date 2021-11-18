export function Main<Cnf extends { one: any }, Deps>(cnf: Cnf, deps: Deps) {
  const { one } = cnf;

  console.log("One module init cnf: %o", one);
  function show(name: string) {
    return `Name: ${name} is showing`;
  }
  console.log(Object.keys(deps));

  return { show };
}
