import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface DrawingPadHandle {
  submit: () => void;
}

interface DrawingPadProps {
  disabled?: boolean;
  onSubmit: (imageBlob: Blob) => void;
}

export const DrawingPad = forwardRef<DrawingPadHandle, DrawingPadProps>(function DrawingPad(
  { disabled = false, onSubmit }: DrawingPadProps,
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.fillStyle = "#fffdf5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 5;
    context.strokeStyle = "#111827";
  }, []);

  useEffect(() => {
    if (disabled) {
      drawingRef.current = false;
    }
  }, [disabled]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) {
      return;
    }
    event.preventDefault();

    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }

    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) {
      return;
    }
    event.preventDefault();

    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }

    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function handlePointerUp(event?: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    if (event) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearCanvas() {
    if (disabled) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fffdf5";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function submitCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.toBlob(
      (imageBlob) => {
        if (imageBlob) {
          onSubmit(imageBlob);
        }
      },
      "image/jpeg",
      0.78,
    );
  }

  useImperativeHandle(ref, () => ({
    submit() {
      submitCanvas();
    },
  }));

  return (
    <div className="drawing-pad">
      <canvas
        ref={canvasRef}
        width={640}
        height={420}
        draggable={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="drawing-actions">
        <button className="secondary-button" onClick={clearCanvas} disabled={disabled}>
          전체 지우기
        </button>
      </div>
    </div>
  );
});
