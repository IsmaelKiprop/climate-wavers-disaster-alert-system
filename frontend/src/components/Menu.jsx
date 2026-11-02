import AppNav from "./app/AppNav";

const Menu = ({ setIsOpen }) => {
  return <AppNav onNavigate={() => setIsOpen?.(false)} />;
};

export default Menu;
