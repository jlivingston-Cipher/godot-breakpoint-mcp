using Godot;

public partial class DemoSnowman : Node2D
{
    public int Ice { get; set; } = 100;
    public int Shade { get; set; } = 5;
    public bool GrewEver { get; set; } = false;

    private Label _label;

    public override void _Ready()
    {
        _label = GetNode<Label>("Label");
        GD.Print($"[demo] sunshine start, ice={Ice}");
        foreach (int w in new[] { 3, 20, 4, 90 }) ApplyWarmth(w);
    }

    public int ApplyWarmth(int warmth)
    {
        int melt = warmth - Shade;           // BUG: no clamp
        int before = Ice;
        Ice -= melt;                         // <-- BREAKPOINT HERE (line 22)
        if (Ice > before) GrewEver = true;
        GD.Print($"[demo] warmth {warmth} (melt {melt}), ice now {Ice}");
        if (Ice <= 0) { _label.Text = "ALL MELTED"; GD.Print("[demo] ALL MELTED"); }
        return Ice;
    }
}
