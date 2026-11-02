import { IoCloseSharp } from "react-icons/io5";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";

const Modal = ({ children, closeFn, title = "Create Post" }) => {
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      onClick={closeFn}
    >
      <div
        className="bg-surface border border-border w-full sm:max-w-lg max-h-[92dvh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="p-2 hover:bg-background" onClick={closeFn} aria-label="Close">
            <IoCloseSharp size={20} />
          </button>
        </div>
        <div className="overflow-y-auto min-h-0 flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};

Modal.propTypes = {
  children: PropTypes.node,
  closeFn: PropTypes.func,
  title: PropTypes.string,
};

export default Modal;
