// src/components/widgets/Note.jsx
import React, { useState, useEffect } from "react";

const Note = ({ text: textProp, onUpdateWidgetProps }) => {
  const [text, setText] = useState(textProp ?? "");

  useEffect(() => {
    if (typeof onUpdateWidgetProps === "function") {
      onUpdateWidgetProps({ text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="max-w-sm rounded-xl shadow-lg text-gray-900 dark:text-gray-100">
      <textarea
        className="w-full min-h-[300px] p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 resize-auto textarea-hide-scrollbar focus:outline-none focus:ring-0"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your note here..."
      />
    </div>
  );
};

export default Note;

