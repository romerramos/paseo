import { StreamLanguage, type StreamParser, type StringStream } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { html } from "@codemirror/legacy-modes/mode/xml";

interface ErbState {
  html: unknown;
  ruby: unknown;
  /** HTML, Ruby code inside `<% %>`, or an ERB comment `<%# %>`. */
  inside: "html" | "ruby" | "comment";
}

/**
 * ERB is HTML with embedded Ruby. Text outside `<% %>` goes to the HTML mode and code inside
 * goes to the Ruby mode; each inner mode only sees its own part of the line.
 */
const erb: StreamParser<ErbState> = {
  name: "erb",
  startState(indentUnit) {
    return {
      html: html.startState?.(indentUnit) ?? {},
      ruby: ruby.startState?.(indentUnit) ?? {},
      inside: "html",
    };
  },
  copyState(state) {
    return {
      html: copyInner(html, state.html),
      ruby: copyInner(ruby, state.ruby),
      inside: state.inside,
    };
  },
  token(stream, state) {
    if (state.inside === "html") {
      if (stream.match(/^<%(?:#|=|-)?/)) {
        state.inside = stream.current().endsWith("#") ? "comment" : "ruby";
        return "meta";
      }
      return tokenUntil(stream, "<%", html, state.html);
    }
    if (stream.match(/^-?%>/)) {
      state.inside = "html";
      return "meta";
    }
    if (state.inside === "comment") {
      if (!stream.skipTo("%>")) stream.skipToEnd();
      // Leave the "-" of "-%>" for the closing delimiter.
      else if (stream.pos - 1 > stream.start && stream.string[stream.pos - 1] === "-") {
        stream.backUp(1);
      }
      if (stream.pos === stream.start) stream.next();
      return "comment";
    }
    return tokenUntil(stream, "%>", ruby, state.ruby, true);
  },
  blankLine(state, indentUnit) {
    if (state.inside === "html") html.blankLine?.(state.html, indentUnit);
    else if (state.inside === "ruby") ruby.blankLine?.(state.ruby, indentUnit);
  },
};

/** Runs an inner mode on the line with everything from the next `delimiter` onward hidden. */
function tokenUntil(
  stream: StringStream,
  delimiter: string,
  mode: StreamParser<unknown>,
  state: unknown,
  trimDash = false,
): string | null {
  const full = stream.string;
  let end = full.indexOf(delimiter, stream.pos);
  // Keep the "-" of "-%>" for the closing delimiter.
  if (end > stream.pos && trimDash && full[end - 1] === "-") end -= 1;
  if (end === stream.pos) {
    stream.next();
    return null;
  }
  if (end !== -1) stream.string = full.slice(0, end);
  try {
    const style = mode.token(stream, state);
    if (stream.pos === stream.start) stream.next();
    return style;
  } finally {
    stream.string = full;
  }
}

function copyInner(mode: StreamParser<unknown>, state: unknown): unknown {
  if (mode.copyState) return mode.copyState(state);
  if (typeof state !== "object" || state === null) return state;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    copy[key] = Array.isArray(value) ? value.slice() : value;
  }
  return copy;
}

export const erbLanguage = StreamLanguage.define(erb);
