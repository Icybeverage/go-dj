import React from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Icon } from "./Icons";
import { GESTURE_OPTIONS } from "../../features/gestures/config";

export function GestureGrid({
  enabled,
  options,
  activeGesture,
  onToggle,
  onToggleGesture,
}) {
  const selected = GESTURE_OPTIONS.filter((option) => options[option.id]).map(
    (option) => option.id,
  );

  function updateSelected(nextSelected) {
    GESTURE_OPTIONS.forEach((option) => {
      const wasSelected = selected.includes(option.id);
      const isSelected = nextSelected.includes(option.id);
      if (wasSelected !== isSelected) onToggleGesture(option.id);
    });
  }

  return (
    <section className="gesture-panel" aria-labelledby="gesture-title">
      <div className="section-header">
        <div>
          <span className="eyebrow">GESTURES</span>
          <h2 id="gesture-title">Control surface</h2>
        </div>
        <button
          className={`status-toggle ${enabled ? "is-on" : "is-off"}`}
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
        >
          <span className="status-dot" />
          {enabled ? "ON" : "OFF"}
        </button>
      </div>
      <div className="hand-routing" aria-label="Hand deck routing">
        <span>
          <i className="hand-dot hand-dot-a" /> Left hand{" "}
          <strong>DECK A</strong>
        </span>
        <span>
          <i className="hand-dot hand-dot-b" /> Right hand{" "}
          <strong>DECK B</strong>
        </span>
      </div>
      <ToggleGroup
        className="gesture-grid"
        type="multiple"
        value={selected}
        onValueChange={updateSelected}
        aria-label="Gesture controls"
      >
        {GESTURE_OPTIONS.map((option) => {
          const isEnabled = options[option.id];
          const isActive = enabled && isEnabled && activeGesture === option.id;
          return (
            <ToggleGroupItem
              key={option.id}
              value={option.id}
              className={`gesture-card ${isActive ? "is-active" : ""}`}
              aria-label={`${isEnabled ? "Disable" : "Enable"} ${option.label} gesture`}
            >
              <span className="gesture-icon">
                <Icon name={option.id} size={16} />
              </span>
              <span className="gesture-copy">
                <strong>{option.label}</strong>
                <small>{option.pose}</small>
                <em>{option.detail}</em>
              </span>
              <span className="gesture-state">{isEnabled ? "ON" : "OFF"}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </section>
  );
}
