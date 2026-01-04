import Playground from "@/components/Playground";

export default function PlaygroundPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
        <p className="text-gray-400">
          Batch test your model with different parameters.
        </p>
      </div>
      
      <Playground />
    </div>
  );
}