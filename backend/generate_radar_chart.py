import sys
import json
import matplotlib.pyplot as plt
import numpy as np
import os

def create_radar_chart(data, user):
    labels = list(data.keys())
    values = [float(value) for value in data.values()]

    num_vars = len(labels)

    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    values += values[:1]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
    ax.fill(angles, values, color='red', alpha=0.25)
    ax.plot(angles, values, color='red', linewidth=2)

    ax.set_yticklabels([])
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels)

    chart_path = f"{user}_radar_chart.png"
    plt.savefig(chart_path)
    plt.close()
    return chart_path

if __name__ == "__main__":
    data = json.loads(sys.argv[1])
    user = sys.argv[2]
    chart_path = create_radar_chart(data, user)
    print(chart_path)
